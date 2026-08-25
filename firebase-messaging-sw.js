importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCVqV5j0B-J96PwyHc0jmkdpNb5bBFAfOg",
    authDomain: "ten-soporte.firebaseapp.com",
    projectId: "ten-soporte",
    storageBucket: "ten-soporte.firebasestorage.app",
    messagingSenderId: "498950424371",
    appId: "1:498950424371:web:fce299a98cf8e57f822046"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'logo.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});