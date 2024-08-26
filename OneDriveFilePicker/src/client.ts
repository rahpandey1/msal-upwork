import { combine } from "@pnp/core";

const apiUrl = 'http://localhost:8000';

export async function request<T = any>(path: string, init?: RequestInit, token = undefined): Promise<T> {

    path = combine("https://graph.microsoft.com/v1.0/", path);

    const accessToken = token;

    const ini = {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        ...init,
    }

    if (typeof init !== "undefined" && init?.headers) {
        ini.headers = { ...ini.headers, ...init.headers };
    }

    const response = await fetch(path, ini);

    if (!response.ok) {
        throw Error(`[${response.status}] ${response.statusText}`);
    }

    if (response.status !== 204) {

        return response.json();
    }
}

export async function saveUserAuthCode({ user, scope, code, type, personal }) {
    try {
        const userPath = user ? `${encodeURIComponent(user)}/` : '';
        const url = `msgraph/${userPath}auth/${type}/code`;
        const result = await fetch(`${apiUrl}/${url}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ user, scope, code, personal })
        });
        return result;
    }
    catch (e) {
        console.log(`Failed to save user tokens: ${e}`);
    }
}

export async function saveUserFiles({ user, items }) {
    try {
        const url = `msgraph/${encodeURIComponent(user)}/download`;
        const result = await fetch(`${apiUrl}/${url}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ items })
        });
        return result;
    }
    catch (e) {
        console.log(`Failed to save user tokens: ${e}`);
    }
}

export async function fetchAuthTokens(currentUser: string) {
    try {
        const url = `msgraph/${encodeURIComponent(currentUser)}/tokens`;
        const result = await fetch(`${apiUrl}/${url}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            },
        });
        const response = await result.json();
        return response;
    }
    catch (e) {
        console.log(`Failed to fetch user tokens: {e}`);
    }
}