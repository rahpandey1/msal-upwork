import React from "react";
import { MouseEvent, useEffect, useState } from "react";
import { Picker, IFilePickerOptions, Popup, IAuthenticateCommand, IPicker, LamdaAuthenticate, SPItem } from "../picker-api";

export interface PickerProps {
  baseUrl: string;
  pickerPathOverride?: string;
  getToken: (message: IAuthenticateCommand) => Promise<string>;
  options: IFilePickerOptions;
  onResults: (items: SPItem[]) => Promise<void>;
  disabled?: boolean;
  onOpen?: () => Promise<boolean>;
}

// picker button used to launch the picker
function PickerButton(props: PickerProps) {

  const { baseUrl, pickerPathOverride, getToken, options, disabled, onOpen } = props;

  const [contentWindow, setContentWindow] = useState<Window | null>(null);

  const [picker, setPicker] = useState<IPicker | null>(null);

  useEffect(() => {

    const { onResults } = props;

    if (picker) {

      // optionally log notifications to the console
      picker.on.notification(function (this: IPicker, message) {
        this.log("notification: " + JSON.stringify(message));
      });

      // optionally log any logging from the library itself to the console
      picker.on.log(function (this: IPicker, message, level) {
        console.log(`log: [${level}] ${message}`);
      });

      // optionally log any logging from the library itself to the console
      picker.on.error(function (this: IPicker, err) {
        this.log(`error: ${err}`);
      });

      (async () => {

        const results: any = await picker.activate({
          baseUrl,
          pickerPathOverride,
          options,
        });

        if (results) {
          await onResults(results.items);
        }

      })();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker]);

  useEffect(() => {

    if (contentWindow) {

      // create and set the picker API using the content window
      setPicker(Picker(contentWindow).using(
        Popup(),
        LamdaAuthenticate(getToken)));

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentWindow]);

  async function click(e: MouseEvent<HTMLButtonElement>): Promise<void> {

    e.preventDefault();

    const result = await onOpen?.();

    if (result) {
      // open a pop-up
      setContentWindow(window.open("", "Picker", "width=800,height=600"));
    }
  }

  return (
    <button disabled={disabled} onClick={click}>Launch Picker</button>
  );
}

export default PickerButton;
