import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    query,
    where,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export const DataService = {
    // Auth
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    register: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
    logout: () => signOut(auth),
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
    getCurrentUser: () => auth.currentUser,

    // Cache
    clientsCache: null,
    clientsCacheTime: 0,
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

    // Clients
    addClient: async (clientData) => {
        // Invalidate cache
        DataService.clientsCache = null;
        return await addDoc(collection(db, "clients"), {
            ...clientData,
            createdAt: serverTimestamp()
        });
    },

    deleteClient: async (clientId) => {
        // First delete all invoices for this client
        const q = query(collection(db, "invoices"), where("clientId", "==", clientId));
        const snapshot = await getDocs(q);
        const batch = window.writeBatch ? window.writeBatch(db) : null;
        // Note: writeBatch is not imported. Let's just do individual deletes or simple approach.
        // Importing writeBatch and deleteDoc

        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "invoices", d.id)));
        await Promise.all(deletePromises);

        // Then delete client
        await deleteDoc(doc(db, "clients", clientId));

        // Invalidate cache
        DataService.clientsCache = null;
    },

    getClients: async () => {
        const now = Date.now();
        if (DataService.clientsCache && (now - DataService.clientsCacheTime < DataService.CACHE_DURATION)) {
            console.log("Serving clients from cache");
            return DataService.clientsCache;
        }

        const q = query(collection(db, "clients"), orderBy("name"));
        const snapshot = await getDocs(q);
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update cache
        DataService.clientsCache = clients;
        DataService.clientsCacheTime = now;

        return clients;
    },

    getAllInvoices: async (limitCount = 10) => {
        const q = query(
            collection(db, "invoices"),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
    },

    // Invoices
    saveInvoice: async (invoiceData) => {
        // If it has an firebaseId (document ID), update it. 
        // Note: invoiceData might have an internal 'invoiceNumber' (INV001), 
        // but we need the Firestore Document ID to update.

        if (invoiceData.firebaseId) {
            const invoiceRef = doc(db, "invoices", invoiceData.firebaseId);
            const { firebaseId, ...data } = invoiceData;
            await updateDoc(invoiceRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            return firebaseId;
        } else {
            // New invoice
            // Ensure we don't save 'firebaseId' into the document content
            const { firebaseId: _, ...cleanData } = invoiceData;

            const docRef = await addDoc(collection(db, "invoices"), {
                ...cleanData,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        }
    },

    getInvoicesByClient: async (clientId) => {
        console.log(`Fetching invoices for client: "${clientId}"`);
        try {
            if (!clientId) {
                console.error("getInvoicesByClient called with missing clientId");
                return [];
            }
            const q = query(
                collection(db, "invoices"),
                where("clientId", "==", clientId)
            );
            const snapshot = await getDocs(q);
            console.log(`Query "clientId" == "${clientId}" returned ${snapshot.docs.length} docs.`);

            let docs = snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));

            // FALLBACK: If query returns empty, try to find matches manually from recent list (for debugging/resilience)
            if (docs.length === 0) {
                console.log("Direct query empty. Checking via clientName fallback (inefficient but safe)...");
                const allQ = query(collection(db, "invoices"), orderBy("createdAt", "desc"), limit(50));
                const allSnap = await getDocs(allQ);

                // Get client name to match against
                // We don't have the client name here easily unless passed.
                // let's just log what we see in 'all' that matches this ID
                const potentialMatches = allSnap.docs
                    .map(d => d.data())
                    .filter(d => d.clientId == clientId); // Loose equality

                console.log("Potential matches found via scan:", potentialMatches.length);

                if (potentialMatches.length > 0) {
                    console.warn("INDEXING ISSUE LIKELY: Data exists but where() query failed.");
                    // We can't return these easily without their IDs unless we map differently above
                }
            }

            // Client-side sort to avoid composite index requirement
            return docs.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
                const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
                return dateB - dateA;
            });
        } catch (error) {
            console.error("Error fetching invoices:", error);
            // Fallback for indexing errors or strict mode
            return [];
        }
    },

    getInvoice: async (invoiceId) => {
        const docRef = doc(db, "invoices", invoiceId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { firebaseId: docSnap.id, ...docSnap.data() };
        } else {
            return null;
        }
    },

    deleteInvoice: async (invoiceId) => {
        await deleteDoc(doc(db, "invoices", invoiceId));
    },

    fetchAllInvoices: async () => {
        try {
            const q = query(
                collection(db, "invoices"),
                orderBy("createdAt", "desc")
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching all invoices:", error);
            return [];
        }
    },

    markAsPaid: async (invoiceId, isPaid) => {
        const docRef = doc(db, "invoices", invoiceId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const data = snap.data();

        await updateDoc(docRef, {
            isFullyPaid: isPaid,
            receivedAmount: isPaid ? data.totalAmount : 0,
            updatedAt: serverTimestamp()
        });
    },

    updateReceivedAmount: async (invoiceId, amount) => {
        const docRef = doc(db, "invoices", invoiceId);
        const numAmount = parseFloat(amount) || 0;

        // Check if fully paid
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const total = parseFloat(data.totalAmount) || 0;
        const isFullyPaid = numAmount >= total;

        await updateDoc(docRef, {
            receivedAmount: numAmount,
            isFullyPaid: isFullyPaid,
            status: isFullyPaid ? 'paid' : (numAmount > 0 ? 'partial' : 'open'), // Reset closed status if paid
            updatedAt: serverTimestamp()
        });
    },

    closeInvoice: async (invoiceId) => {
        const docRef = doc(db, "invoices", invoiceId);
        await updateDoc(docRef, {
            status: 'closed',
            updatedAt: serverTimestamp()
        });
    }
};
