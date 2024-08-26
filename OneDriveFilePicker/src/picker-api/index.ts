import { _Picker } from "./picker";

export { Popup, Close, CloseOnPick } from "./behaviors/popup-behaviors";
export * from "./behaviors/setup";
export * from "./behaviors/msal-authenticate";
export { LamdaAuthenticate } from "./behaviors/lamda-authenticate";
export * from "./behaviors/resolves";
export { RejectOnErrors } from "./behaviors/errors";
export { Embed } from "./behaviors/embed-behaviors";
export * from "./behaviors/log-notifications";

export type {
    IFilePickerOptions,
    IAuthenticateCommand,
    IPickData,
    SPItem,
} from "./types";

export type PickerInit = [];

export function Picker(window: Window): _Picker {

    if (typeof window === "undefined") {
        throw Error("You must supply a valid Window for the picker to render within.");
    }

    return new _Picker(window);
}

export type IPicker = ReturnType<typeof Picker>;
