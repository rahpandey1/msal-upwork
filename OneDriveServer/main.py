import os

import uvicorn
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import sqlite3
import urllib.parse

#client_id = '00b2b3ae-0eff-40cb-aeca-1da586295121'
client_id = '05e7bcc2-50c4-4f50-be24-67c0ea0304ed'
client_secret = 'zAl8Q~R4vrObd38S_MllzrndVKuQd3oaTQKeEa8D'

class AuthorizationContext(BaseModel):
    endpoint: str
    body: str | dict
    scope: str
    headers: dict

class AuthorizationCodeContext(BaseModel):
    personal: bool
    scope: str
    code: str

class Tokens(BaseModel):
    access_token: str
    refresh_token: str
    scope: str | None

class DownloadItems(BaseModel):
    items: list = []

class Storage:
    def __init__(self):
        con, cur = self.create_cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS ms_users_ex(user, access_token_api, refresh_token_api, api_scope, access_token_ui, refresh_token_ui, ui_scope)")
        self.close_cursor(con, cur)

    def create_cursor(self):
        con = sqlite3.connect("users.db")
        cur = con.cursor()
        return con, cur

    def close_cursor(self, con, cur):
        con.commit()
        cur.close()
        con.close()

    def get_user_ex(self, user, cur):
        res = cur.execute("SELECT user, access_token_api, refresh_token_api, api_scope, access_token_ui, refresh_token_ui, ui_scope FROM ms_users_ex WHERE user = ?", (user,))
        return res.fetchone()

    def get_user(self, user):
        con, cur = self.create_cursor()
        db_user = self.get_user_ex(user, cur)
        self.close_cursor(con, cur)

        return {
            "user": db_user[0],
            "access_token_api": db_user[1],
            "refresh_token_api": db_user[2],
            "api_scope": db_user[3],
            "access_token_ui": db_user[4],
            "refresh_token_ui": db_user[5],
            "ui_scope": db_user[6],
        } if db_user else None

    def save_tokens(self, user, tokens, type, cur):
        db_user = self.get_user_ex(user, cur)

        if db_user is None:
            res = cur.execute(f"INSERT INTO ms_users_ex(user, access_token_{type}, refresh_token_{type}, {type}_scope) VALUES (?, ?, ?, ?)", (user, tokens.access_token, tokens.refresh_token, tokens.scope))
        else:
            res = cur.execute(f"UPDATE ms_users_ex SET access_token_{type} = ?, refresh_token_{type} = ?, {type}_scope = ? WHERE user = ?", (tokens.access_token, tokens.refresh_token, tokens.scope, user))

        print(f"saving token of type {type} for user {user}:\n{tokens.access_token}")

        return res

    def save_tokens_of_type(self, user, tokens, type):
        con, cur = self.create_cursor()
        self.save_tokens(user, tokens, type, cur)
        self.close_cursor(con, cur)

    def save_api_tokens(self, user, tokens):
        self.save_tokens_of_type(user, tokens, 'api')

    def save_ui_tokens(self, user, tokens):
        self.save_tokens_of_type(user, tokens, 'ui')

    def save_user(self, user, api_tokens, ui_tokens):
        con, cur = self.create_cursor()
        self.save_tokens(user, api_tokens, 'api', cur)
        self.save_tokens(user, ui_tokens, 'ui', cur)
        self.close_cursor(con, cur)


primary_origin = "http://localhost:3000"

origins = [
    "http://localhost",
    primary_origin,
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage = Storage()

def get_token_endpoint(personal: bool):
    tenant = 'consumers' if personal else 'common'
    return f'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token'

def get_user_name(access_token):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    url = "https://graph.microsoft.com/v1.0/me"

    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        body = response.json()
        return body["mail"]

    return ''

async def do_save_user_auth(user_name: str, type: str, auth: AuthorizationContext):
    headers = auth.headers
    response = requests.post(auth.endpoint, data=auth.body, headers=headers)
    if response.status_code != 200:
        response.status_code = status.HTTP_404_NOT_FOUND
        return None

    result = response.json()

    scope = auth.scope# if type == 'api' else result['scope']

    access_token = result['access_token']
    if user_name == '':
        user_name = get_user_name(access_token)
        result['user'] = user_name

    tokens = Tokens(access_token=access_token, refresh_token=result['refresh_token'], scope=scope)
    if (type == "api") or (type == "ui"):
        storage.save_tokens_of_type(user_name, tokens, type)

    return result

async def do_save_user_auth_code(user, type, code: AuthorizationCodeContext):
    body = {
        'client_id': client_id,
        'scope': code.scope,
        'code': code.code,
        'client_secret': client_secret,
        'redirect_uri': 'http://localhost:3000/web',
        'grant_type': 'authorization_code'
    }
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    endpoint = get_token_endpoint(code.personal)
    auth = AuthorizationContext(endpoint=endpoint, body=body, scope=code.scope, headers=headers)
    return await do_save_user_auth(user, type, auth)

@app.post("/msgraph/auth/{type}/code")
async def save_user_auth_code(type: str, code: AuthorizationCodeContext):
    return await do_save_user_auth_code('', type, code)

@app.post("/msgraph/{user_name}/auth/{type}/code")
async def save_user_auth_code(type: str, user_name: str, code: AuthorizationCodeContext):
    return await do_save_user_auth_code(user_name, type, code)

@app.post("/msgraph/{user_name}/tokens")
async def save_user_token(user_name: str, tokens: Tokens):
    return {"result": user_name}


def refresh_tokens(access_token, refresh_token, scope):
    token_url = f"https://login.microsoftonline.com/common/oauth2/v2.0/token"

    # Prepare the data for the POST request
    data = {
        "client_id": client_id,
        "scope": scope,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }

    response = requests.post(token_url, data=data, headers={'Origin': primary_origin})

    if response.status_code == 200:
        tokens = response.json()
        access_token = tokens.get("access_token")
        new_refresh_token = tokens.get("refresh_token")

        tokens = Tokens(access_token=access_token, refresh_token=new_refresh_token, scope=scope)
        return tokens
    else:
        print(f"Error during tokens refresh: {response.status_code}")
        print(response.json())
        tokens = Tokens(access_token=access_token, refresh_token=refresh_token, scope=scope)
        return tokens


@app.get("/msgraph/{user_name}/tokens")
async def get_user_token(user_name, response: Response):
    user = storage.get_user(user_name)
    api_token = refresh_tokens(user['access_token_api'], user['refresh_token_api'], user['api_scope'])
    ui_token = refresh_tokens(user['access_token_ui'], user['refresh_token_ui'], user['ui_scope'])

    # Check if the request was successful
    if api_token and ui_token:
        print("Tokens refreshed successfully")
        storage.save_user(user_name, api_token, ui_token)

        return {
            "user": user_name,
            "api_tokens": {
                "access_token": api_token.access_token,
                "refresh_token": api_token.refresh_token,
            },
            "ui_tokens": {
                "access_token": ui_token.access_token,
                "refresh_token": ui_token.refresh_token,
            }
        }
    else:
        response.status_code = status.HTTP_404_NOT_FOUND
        return None

def call_graph_api(user, sub_url):
    access_token = user['access_token_api']
    headers = {
        "Authorization": f"Bearer {access_token}",
    }

    # URL to list the files in the root of the user's OneDrive
    url = f"https://graph.microsoft.com/v1.0/me/{sub_url}"

    access_token = user['access_token_api']
    headers = {
        "Authorization": f"Bearer {access_token}",
    }

    response = requests.get(url, headers=headers)
    return response


def download_folder_contents(user, folder_id, local_folder_name):
    # List the contents of the folder
    response = call_graph_api(user, f"drive/items/{folder_id}/children")

    if response.status_code == 200:
        folder_contents = response.json()
        os.makedirs(local_folder_name, exist_ok=True)

        for item in folder_contents.get('value', []):
            if 'file' in item:  # Download files
                file_id = item['id']
                file_name = item['name']

                file_response = call_graph_api(user, f"drive/items/{file_id}/content")
                if file_response.status_code == 200:
                    file_path = os.path.join(local_folder_name, file_name)
                    with open(file_path, 'wb') as file:
                        file.write(file_response.content)
                    print(f"Downloaded file: {file_name}")
                else:
                    print(f"Failed to download {file_name}: {response.status_code} - {response.text}")

            elif 'folder' in item:  # Recursively download subfolders
                subfolder_id = item['id']
                subfolder_name = item['name']
                subfolder_path = os.path.join(local_folder_name, subfolder_name)
                download_folder_contents(user, subfolder_id, subfolder_path)
    else:
        print(f"Failed to download folder: {response.status_code} - {response.text}")

def get_item_name(user, item_id):
    meta_response = call_graph_api(user, f'drive/items/{item_id}')
    if meta_response.status_code == 200:
        metadata = meta_response.json()
        return metadata.get('name')
    return 'unknown'

def download_file(user, file_id, local_folder_name):
    meta_response = call_graph_api(user, f'drive/items/{file_id}')
    if meta_response.status_code == 200:
        os.makedirs(local_folder_name, exist_ok=True)
        metadata = meta_response.json()
        file_name = metadata.get('name')

        response = call_graph_api(user, f'drive/items/{file_id}/content')
        if response.status_code == 200:
            # Save the file locally
            file_path = os.path.join(local_folder_name, file_name)
            with open(file_path, "wb") as file:
                file.write(response.content)
            print(f"Downloaded file: {file_name}")
        else:
            print(f"Failed to download {file_name}: {response.status_code} - {response.text}")

@app.post("/msgraph/{user_name}/download")
async def save_user_files(user_name, items: DownloadItems):
    print(f'User {user_name} selected items to download: {items.items}')
    downloads_folder = 'Downloads'
    user = storage.get_user(user_name)

    for item in items.items:
        folder = item['folder']
        item_id = item['id']
        if folder:
            folder_path = os.path.join(downloads_folder, get_item_name(user, item_id))
            download_folder_contents(user, item_id, folder_path)
        else:
            download_file(user, item_id, downloads_folder)

    return None

@app.get("/msgraph/{user_name}/files")
async def get_user_files(user_name, response: Response):
    user = storage.get_user(user_name)
    if user is None:
        response.status_code = status.HTTP_404_NOT_FOUND
        return None

    files_response = call_graph_api(user, 'me/drive/root/children')

    if files_response.status_code == 200:
        files = files_response.json()
        return files
    else:
        print("Error listing files:", files_response.status_code, files_response.text)
        response.status_code = files_response.status_code
        return None

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
