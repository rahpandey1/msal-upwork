import { combine } from "@pnp/core";
import {request} from "./client";

export const personalUrl = 'https://onedrive.live.com/picker';
export const apiScopes = ['https://graph.microsoft.com/.default', 'offline_access'];
const clientId = '05e7bcc2-50c4-4f50-be24-67c0ea0304ed';

export function getResourceScopes(baseUrl) {
    const tenantScopes = [combine(baseUrl, '.default'), 'offline_access'];
    const personalScopes = ['OneDrive.ReadOnly', 'offline_access'];
    const useConsumerApp = baseUrl.includes('onedrive.');
    const scopes = useConsumerApp ? personalScopes : tenantScopes;

    return { scopes, useConsumerApp };
}

export function getAuthCodeUrl(personal, account, scopes) {
    const authParams = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: 'http://localhost:3000/web',
        response_mode: 'query',
        scope: scopes.join(' '),
        state: '12345'
    });
    if (account) {
        authParams.append('login_hint', account);
    }
    else {
        authParams.append('prompt', 'select_account');
    }

    const baseUrl = personal ? 'https://login.microsoftonline.com/consumers' : 'https://login.microsoftonline.com/common';
    const authUrl = `${baseUrl}/oauth2/v2.0/authorize?${authParams.toString()}`;
    return authUrl;
}

export async function getBaseUrl(apiToken) {
    try {
        const orgResponse = await request<any>('organization', {method: 'GET'}, apiToken);
        const tenantDomain = orgResponse?.['value']?.[0]?.['verifiedDomains']?.[0]?.['name'];
        const tenant = tenantDomain ? tenantDomain.substring(0, tenantDomain.indexOf('.')) : undefined;
        return tenant ? `https://${tenant}-my.sharepoint.com/` : personalUrl;
    }
    catch (e) {
        console.log(`Failed to fetch organization: ${e}`);
        return personalUrl;
    }
}
