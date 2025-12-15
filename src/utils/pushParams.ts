export const VAPID_PUBLIC_KEY = "BFoFzA5OC76CeFycttdayo0bfgfEn_cmREVyLDlY3T4OozNwsRrt3vVj4_MhxEtc_QiqErbzBN9wEs6A8trbhIc";

export function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
