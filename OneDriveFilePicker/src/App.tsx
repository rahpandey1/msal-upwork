import React, { useState } from 'react';
import './App.css';
import PickerButton from './components/picker';
import { AuthButton } from './components/authentication';
import {IAuthenticateCommand, IFilePickerOptions} from "./picker-api";
import PickedFilesList from './components/picked-files-list';
import {fetchAuthTokens, saveUserFiles} from './client';
import {CircularProgress} from "@mui/material";

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

  const [results, setResults] = useState(null);

  async function onPicked(pickerResults) {
    if (pickerResults) {
      setResults(pickerResults);
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
    const {ui_tokens, api_tokens} = currentUserTokens || {};
    const token = (command.type === 'SharePoint' ? ui_tokens?.access_token : ui_tokens?.access_token) || '';
    const token2 = null;//await getToken(command);
    console.log(`saved token type ${command.type}:`, token);
    //console.log(`created token type ${command.type}:`, token2);
    return token;
  }

  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('currentMsUser'));
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('currentSharepointUrl'));
  const [currentUserTokens, setCurrentUserTokens] = useState<any>();
  const [statusText, setStatusText] = useState('');

  //const [msTenant, setMsTenant] = useState('inmartech');//inmartech
  //const baseUrl = msTenant ? `https://${msTenant}-my.sharepoint.com/` : 'https://onedrive.live.com/picker';
  //<input value={msTenant} onChange={e => setMsTenant(e.target.value)}/>
  //<label>
  //  <span style={{paddingRight: 10}}>Enter tenant name (leave empty for personal account):</span>
  //</label>

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

        {false && <PickedFilesList items={results}/>}
      </div>
  );
}

export default App;
