import React from "react";
import { apiScopes, personalUrl, getAuthCodeUrl, getBaseUrl, getResourceScopes} from "../auth";
import { saveUserAuthCode } from "../client";

export interface AuthProps {
    personalAccount: boolean;
    setCurrentUser: any;
    setBaseUrl: any;
    setLoading: any;
}

async function monitorPopupForHash(popupWindow: Window): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const intervalId = setInterval(() => {
            // Window is closed
            if (popupWindow.closed) {
                clearInterval(intervalId);
                reject(new Error('User cancelled'));
                return;
            }

            let href = "";
            try {
                /*
                 * Will throw if cross-origin,
                 * which should be caught and ignored
                 * since we need the interval to keep running while on STS UI.
                 */
                href = popupWindow.location.href;
            } catch (e) {}

            // Don't process blank pages or cross domain
            if (!href || href === "about:blank") {
                return;
            }
            clearInterval(intervalId);

            let responseString = "";
            if (popupWindow) {
                responseString = popupWindow.location.search;
            }

            resolve(responseString);
        }, 30);
    }).finally(() => {
        cleanPopup(popupWindow);
    });
}

function cleanPopup(popupWindow?: Window) {
    if (popupWindow) {
        popupWindow.close();
    }
}

async function generateAuthCode(personalAccount, user, scopes) {
    const authUrl = getAuthCodeUrl(personalAccount, user, scopes);
    const popupWindow = window.open(authUrl, "PickerAuth", "popup,width=800,height=600");
    try {
        const responseString = await monitorPopupForHash(popupWindow);
        const params = new URLSearchParams(responseString);
        return params?.get('code');
    }
    catch (e) {
        return '';
    }
}

export function AuthButton(props: AuthProps) {
    const { personalAccount, setCurrentUser, setBaseUrl, setLoading } = props;

    async function Authenticate() {
        const apiCode = await generateAuthCode(personalAccount, undefined, apiScopes);
        console.log(apiCode);

        setLoading(true);
        try {
            const apiResponse = await saveUserAuthCode({ user: '', code: apiCode, scope: apiScopes.join(' '), type: 'api', personal: personalAccount });
            const apiResponseBody = await apiResponse.json();
            const apiToken = apiResponseBody?.access_token;
            const user = apiResponseBody?.user;
            console.log(`generated api token for user ${user}:`, apiToken);

            const baseUrl = (apiToken && !personalAccount) ? await getBaseUrl(apiToken) : personalUrl;
            const { scopes, useConsumerApp } = getResourceScopes(baseUrl);
            const uiCode = await generateAuthCode(personalAccount, user, scopes);

            const uiResponse = await saveUserAuthCode({ user, code: uiCode, scope: scopes.join(' '), type: 'ui', personal: useConsumerApp });

            const uiResponseBody = await uiResponse.json();
            console.log(`generated ui token for user ${user}:`, uiResponseBody?.access_token);

            setCurrentUser(user);
            setBaseUrl(baseUrl);
        }
        catch (e) {
            console.log(`Failed to authenticate: ${e}`);
        }

        setLoading(false);
    }

    const details = personalAccount ? 'Personal account' : 'Enterprise account';
    return (
        <button onClick={Authenticate}>Authenticate ({details})</button>
    );
}
