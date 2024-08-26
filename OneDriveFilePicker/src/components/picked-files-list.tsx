import { SPItem } from "../picker-api";
import Thumbnail from "./thumbnail";
import Preview from "./preview";
import CopyLink from "./copy-link";
import Download from "./download";
import Delete from "./delete";

export interface PickedFileProps {
    items: SPItem[];
}

// here we create a set of actions that will be applied to each selected file
const actions = [
    Preview,
    CopyLink,
    Download,
    Delete,
];

// this is the picked file list control that renders a simply table
function pickedFilesList(props: PickedFileProps) {

    const { items } = props;

    console.log(items);

    return (
        <div>
            <table>
                <tbody>
                {
                    (items && items.map((item, index) => {

                        // we generate a thumbnail for each document, and then list any actions to the right
                        return (<tr key={index}><td key={`${index}-0`}>{Thumbnail(item)}</td>{actions && actions.map(action => (<td key={`${index}-1`}>{action(item)}</td>))}</tr>)

                    })) || <tr key={'0'}><td key={'0-1'}>No Items selected</td></tr>
                }
                </tbody>
            </table>
        </div>
    );

}

export default pickedFilesList;
