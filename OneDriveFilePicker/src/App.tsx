import React, { useState } from 'react';
import './App.css';
import PickerButton from './components/picker';
import { AuthButton } from './components/authentication';
import { IAuthenticateCommand, IFilePickerOptions } from "./picker-api";
import { fetchAuthTokens, saveUserFiles } from './client';
import { CircularProgress } from "@mui/material";

const paramsTest: IFilePickerOptions = {
  sdk: "8.0",
  entry: {
    oneDrive: {}
  },
  authentication: {},
  messaging: {
    origin: "http://localhost:3000",
    channelId: "27"
  },
  selection: {
    mode: "multiple",
  },
  typesAndSources: {
    // filters: [".docx"],
    mode: "all",
    pivots: {
      oneDrive: true,
      recent: true,
    }
  }
};

function App() {

  async function onPicked(pickerResults) {
    if (pickerResults) {
      setStatusText('Downloading files');
      const items = pickerResults.map(item => ({id: item.id, folder: !!item.folder}));
      await saveUserFiles({ user: currentUser, items });
      setStatusText('');
    }
  }

  function saveCurrentUser(user) {
    setCurrentUser(user);
    localStorage.setItem('currentMsUser', user);
  }

  function saveBaseUrl(user) {
    setBaseUrl(user);
    localStorage.setItem('currentSharepointUrl', user);
  }

  async function onPickerOpen() {
    setLoading(true);
    const result = await fetchAuthTokens(currentUser);
    setCurrentUserTokens(result);
    setLoading(false);
    return result?.ui_tokens?.access_token;
  }

  async function getCurrentUserToken(command: IAuthenticateCommand): Promise<string> {
    const { ui_tokens, api_tokens } = currentUserTokens || {};
    const token = (command.type === 'SharePoint' ? ui_tokens?.access_token : ui_tokens?.access_token) || '';
    console.log(`saved token type ${command.type}:`, token);
    return token;
  }

  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('currentMsUser'));
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('currentSharepointUrl'));
  const [currentUserTokens, setCurrentUserTokens] = useState<any>();
  const [statusText, setStatusText] = useState('');

  const personalUrl = baseUrl?.includes('live.com');
  const pickerPath = personalUrl ? '' : '_layouts/15/FilePicker.aspx';

  return (
      <div className="App">
        <div style={{paddingTop: 10}}><span>User sharepoint URL: </span>{baseUrl}</div>
        <div className="ButtonRow">
          <AuthButton personalAccount={true} setCurrentUser={saveCurrentUser} setBaseUrl={saveBaseUrl} setLoading={setLoading}/>
          <AuthButton personalAccount={false} setCurrentUser={saveCurrentUser} setBaseUrl={saveBaseUrl} setLoading={setLoading}/>
          <button onClick={async (e) => {
            e.preventDefault();
            saveCurrentUser('');
          }}>Logout</button>
          <PickerButton baseUrl={baseUrl} disabled={!currentUser || loading}
                        pickerPathOverride={pickerPath} onOpen={onPickerOpen}
                        getToken={getCurrentUserToken} options={paramsTest} onResults={onPicked}/>
        </div>
        <div style={{paddingTop: 10}}>
          {!!statusText && <div style={{paddingBottom: 10}}>{statusText}</div>}
          {(!!statusText || loading) && <CircularProgress />}
        </div>
      </div>
  );
}

export default App;
