// Firebase config & initialization
const firebaseConfig = {
  apiKey: "AIzaSyCsZTHq9c8z0QSNiTksBbU-aHlVf-IsAlA",
  authDomain: "maid-6b3ae.firebaseapp.com",
  databaseURL: "https://maid-6b3ae-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "maid-6b3ae",
  storageBucket: "maid-6b3ae.firebasestorage.app",
  messagingSenderId: "766371021748",
  appId: "1:766371021748:web:dbeccb210a83c955968e1",
  measurementId: "G-0Y0VKYEDE6"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();