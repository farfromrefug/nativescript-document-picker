import { isIOS } from 'tns-core-modules/ui/core/view';
import * as app from 'tns-core-modules/application';
import * as permissions from 'nativescript-permissions';
import { FilePickerOptions } from './filepicker.common';

export { FilePickerOptions };

function callIntent(intent, pickerType) {
    const requestPermissions = [android.Manifest.permission.WRITE_EXTERNAL_STORAGE];

    return permissions.requestPermission(requestPermissions, 'Need these permissions to access files').then(
        () =>
            new Promise((resolve: (r: app.AndroidActivityResultEventData) => void, reject) => {
                const onEvent = function(e: app.AndroidActivityResultEventData) {
                    if (e.requestCode === pickerType) {
                        resolve(e);
                        app.android.off(app.AndroidApplication.activityResultEvent, onEvent);
                    }
                };
                app.android.once(app.AndroidApplication.activityResultEvent, onEvent);
                app.android.foregroundActivity.startActivityForResult(intent, pickerType);
                // function onResult(args) {
                //     app.android.off(app.AndroidApplication.activityResultEvent, onResult);
                //     t.handleResults(args.requestCode, args.resultCode, args.intent);
                // }
            })
        // app.android.on(app.AndroidApplication.activityResultEvent, onResult);

        // function onResult(args) {
        //     app.android.off(app.AndroidApplication.activityResultEvent, onResult);
        //     t.handleResults(args.requestCode, args.resultCode, args.intent);
        // }
    );
}

function getFilePath(context: android.content.Context, uri: android.net.Uri) {
    if (android.os.Build.VERSION.SDK_INT >= 126) {
        const file = new java.io.File(uri.getPath()); // create path from uri
        return file.getPath().split(':')[1];
    }

    let selection = null;
    let selectionArgs = null;
    // Uri is different in versions after KITKAT (Android 4.4), we need to
    if (android.os.Build.VERSION.SDK_INT >= 19 && android.provider.DocumentsContract.isDocumentUri(context.getApplicationContext(), uri)) {
        if (isExternalStorageDocument(uri)) {
            const docId = android.provider.DocumentsContract.getDocumentId(uri);
            const split = docId.split(':');
            return android.os.Environment.getExternalStorageDirectory() + '/' + split[1];
        } else if (isDownloadsDocument(uri)) {
            const id = android.provider.DocumentsContract.getDocumentId(uri);
            uri = android.content.ContentUris.withAppendedId(android.net.Uri.parse('content://downloads/public_downloads'), parseInt(id, 10));
        } else if (isMediaDocument(uri)) {
            const docId = android.provider.DocumentsContract.getDocumentId(uri);
            const split = docId.split(':');
            const type = split[0];
            if (type === 'image') {
                uri = android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            } else if (type === 'video') {
                uri = android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
            } else if (type === 'audio') {
                uri = android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            }
            selection = '_id=?';
            selectionArgs = [split[1]];
        }
    }
    if (uri.getScheme().toLowerCase() === 'content') {
        if (isGooglePhotosUri(uri)) {
            return uri.getLastPathSegment();
        }

        const projection = [(android.provider.MediaStore.Images.Media as any).DATA];
        let cursor: android.database.Cursor = null;
        try {
            cursor = context.getContentResolver().query(uri, projection, selection, selectionArgs, null);
            const column_index = cursor.getColumnIndexOrThrow((android.provider.MediaStore.Images.Media as any).DATA);
            if (cursor.moveToFirst()) {
                return cursor.getString(column_index);
            }
        } catch (e) {}
    } else if (uri.getScheme().toLowerCase() === 'file') {
        return uri.getPath();
    }
    return null;
}

function isExternalStorageDocument(uri) {
    return uri.getAuthority() === 'com.android.externalstorage.documents';
}

function isDownloadsDocument(uri) {
    return uri.getAuthority() === 'com.android.providers.downloads.documents';
}

function isMediaDocument(uri) {
    return uri.getAuthority() === 'com.android.providers.media.documents';
}

function isGooglePhotosUri(uri) {
    return uri.getAuthority() === 'com.google.android.apps.photos.content';
}

export function openFilePicker(params: FilePickerOptions) {
    console.log('openFilePicker', params, isIOS);

    // const FilePickerActivity = (com as any).nononsenseapps.filepicker.FilePickerActivity;
    // const Utils = (com as any).nononsenseapps.filepicker.Utils;
    let extensions;

    if (params.extensions.length > 0) {
        extensions = Array.create(java.lang.String, params.extensions.length);

        for (let i = 0; i < params.extensions.length; i++) {
            extensions[i] = params.extensions[i];
        }
    }

    //     const  intent = new android.content.Intent(android.content.Intent.ACTION_GET_CONTENT);
    //     intent.setType("*/*.im");
    //     intent.addCategory(Intent.CATEGORY_OPENABLE);

    // try {
    //     startActivityForResult(
    //             Intent.createChooser(intent, "Select a File to Upload"),
    //             FILE_SELECT_CODE);
    // } catch (android.content.ActivityNotFoundException ex) {
    //     // Potentially direct the user to the Market with a Dialog
    //     Toast.makeText(this, "Please install a File Manager.",
    //             Toast.LENGTH_SHORT).show();
    // }

    const FILE_CODE = 1231;

    const intent = new android.content.Intent(android.content.Intent.ACTION_GET_CONTENT);
    intent.setType(params.extensions ? params.extensions.join(' | ') : '*/*');
    intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);
    intent.setAction(android.content.Intent.ACTION_OPEN_DOCUMENT);
    // const intent = new android.content.Intent(app.android.foregroundActivity, FilePickerActivity.class);
    intent.putExtra(android.content.Intent.EXTRA_ALLOW_MULTIPLE, !!params.multipleSelection);
    // intent.putExtra(FilePickerActivity.EXTRA_ALLOW_CREATE_DIR, false);
    // intent.putExtra(FilePickerActivity.EXTRA_MODE, FilePickerActivity.MODE_FILE);
    // intent.putExtra(android.content.Intent.EXTRA_START_PATH, android.os.Environment.getExternalStorageDirectory().getPath());
    return callIntent(intent, FILE_CODE).then((result: app.AndroidActivityResultEventData) => {
        if (result.resultCode === android.app.Activity.RESULT_OK) {
            // The document selected by the user won't be returned in the intent.
            // Instead, a URI to that document will be contained in the return intent
            // provided to this method as a parameter.
            // Pull that URI using resultData.getData().
            if (result.intent != null) {
                const context = app.android.foregroundActivity;
                const uri: android.net.Uri = result.intent.getData();
                return {
                    files: [getFilePath(context, uri)],
                    android: uri
                };
            }
            return{
                files: []
            };

            // Use the provided utility method to parse the result
            // const output = [];
            // const files = Utils.getSelectedFilesFromResult(intent);
            // for (let i = 0; i < files.count; i++) {
            //     output.push(Utils.getFileForUri(files[i]));
            // }
            // return {
            //     files: output,
            //     android: files
            // };
        } else {
            throw new Error('no_file');
        }
    });
}