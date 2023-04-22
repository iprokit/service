export function createString(size: number) {
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let body = '';
    for (let i = 0; i < size; i++) {
        body += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return body;
}

export function createIdentifier() {
    return createString(10);
}

export function createMap() {
    return `${createString(10)}.${createString(10)}`;
}

export function createBody(size: number) {
    return createString(size);
}