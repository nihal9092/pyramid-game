function openSecretMenu() {
    const masterKey = prompt("Identity required:");
    if (masterKey === "OWNER NG") {
        document.getElementById('admin-ui').style.display = 'block';
    }
}
