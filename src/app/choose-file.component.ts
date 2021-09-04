import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatCard } from '@angular/material/card';
import { MatSelectionList, MatListOption } from '@angular/material/list';
import { SelectionModel } from '@angular/cdk/collections';
import { catchError } from 'rxjs/operators';

import { ChooseFileService } from './choose-file.service';
// import * as firebase from "firebase/app";
// import 'firebase/storage';


// import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.1/firebase-storage.js";

// import { initializeApp } from "firebase/app";
// import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
// import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// const storage = getStorage();
//
// const firebaseConfig = {
//   apiKey: "AIzaSyBaQ4JDpRWBpcNdMpK1BmSSDed33hVnlqY",
//   authDomain: "droplet-measurement-a396a.firebaseapp.com",
//   databaseURL: "https://droplet-measurement-a396a.firebaseio.com",
//   projectId: "droplet-measurement-a396a",
//   storageBucket: "droplet-measurement-a396a.appspot.com",
//   messagingSenderId: "283281649775",
//   appId: "1:283281649775:web:0251413ef72a12cf3b1d9a",
//   measurementId: "G-C43CYQP4V0"
// };
//
// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
//
// // const storage = firebase.storage();
// console.log('storage', storage);
// // Create the file metadata
// /** @type {any} */
// const metadata = {
//   contentType: 'image/jpeg'
// };








interface ItemData {
    items: { name: string }[],
};

const executeWorkflowUrl = 'https://workflowexecutions.googleapis.com/v1beta/projects/droplet-measurement-309203/locations/us-central1/workflows/video-processor/executions';
const readBucketName = 'droplet-measurement-processed-public';
const writeBucketName = 'droplet-measurement-public';
const readGcsUrl = 'https://storage.googleapis.com/storage/v1/b/' + readBucketName + '/o';
export const readGcsUrlPrefix = 'https://' + readBucketName + '.storage.googleapis.com/';
export const writeGcsUrlPrefix = 'https://' + writeBucketName + '.storage.googleapis.com/';

@Component({
  selector: 'choose-file',
  templateUrl: './choose-file.component.html',
  styles: [],
})
export class ChooseFileComponent {
    private files = new Map();
    // private readBucketName = 'droplet-measurement-processed-public';
    // private writeBucketName = 'droplet-measurement-public';
    // private readGcsUrl = 'https://storage.googleapis.com/storage/v1/b/' + this.readBucketName + '/o';
    // public readGcsUrlPrefix = 'https://' + this.readBucketName + '.storage.googleapis.com/';
    // public writeGcsUrlPrefix = 'https://' + this.writeBucketName + '.storage.googleapis.com/';
    public writeGcsUrlPrefix = writeGcsUrlPrefix;


    @ViewChild('file', {static: true}) private fileInput: ElementRef;
    @ViewChild('fileSelection', {static: true}) private selectionList: MatSelectionList;
    @ViewChild('startTime', {static: true}) private startTime: HTMLInputElement;
    @ViewChild('timeInterval', {static: true}) private timeInterval: HTMLInputElement;

    constructor(private http: HttpClient, private fileService: ChooseFileService) {
        this.refreshFiles();
    }

    public ngOnInit() {
        this.selectionList.selectedOptions = new SelectionModel<MatListOption>(false);
    }

    public selectionChanged() {
        const selectedFiles = this.selectionList.selectedOptions.selected.map(
            item => this.files.get(item.value));
        const selectedFile = selectedFiles[0] || '';
        this.fileService.chooseFile(selectedFile);
    }

    public fileNames(): string[] {
        return Array.from(this.files.keys());
    }

    public refreshFiles() {
        this.files = new Map();
        this.getFiles()
            .subscribe((data: ItemData) => {
            data.items
                .filter(item => item.name.endsWith('droplet_measurements.json'))
                .forEach((item) => {
                // console.log('item', item);
                this.files.set(this.dirname(item.name), readGcsUrlPrefix + item.name); //this.dirname(item.name)); //item.selfLink);
            });
        });
    }

    public upload() {
        let file = this.fileInput.nativeElement.files[0];
        console.log('fileInput', file);
        // const storageRef = ref(storage, file.name);
        // console.log('##### storage', storage);
        // console.log('##### storageRef', storageRef);
        // const uploadTask = uploadBytesResumable(storageRef, file); //, metadata);
        //
        // // // Listen for state changes, errors, and completion of the upload.
        // uploadTask.on('state_changed',
        //   (snapshot) => {
        //     // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
        //     const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        //     console.log('Upload is ' + progress + '% done');
        //     switch (snapshot.state) {
        //       case 'paused':
        //         console.log('Upload is paused');
        //         break;
        //       case 'running':
        //         console.log('Upload is running');
        //         break;
        //     }
        //   },
        //   (error) => {
        //     // A full list of error codes is available at
        //     // https://firebase.google.com/docs/storage/web/handle-errors
        //     switch (error.code) {
        //       case 'storage/unauthorized':
        //         // User doesn't have permission to access the object
        //         break;
        //       case 'storage/canceled':
        //         // User canceled the upload
        //         break;
        //
        //       // ...
        //
        //       case 'storage/unknown':
        //         // Unknown error occurred, inspect error.serverResponse
        //         break;
        //     }
        //   },
        //   () => {
        //     // Upload completed successfully, now we can get the download URL
        //     getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
        //       console.log('File available at', downloadURL);
        //     });
        //   }
        // );

        // let data = new FormData();
        // const httpOptions = {
        //     headers: new HttpHeaders({
        //         'Content-Type':  'multipart/form-data',
        //         // 'Access-Control-Allow-Origin': 'localhost:4200',
        //         // Authorization: 'my-auth-token',
        //     }),
        // };
        // console.log('data', data);
        // this.http.post(writeGcsUrlPrefix, data, httpOptions)
        // .subscribe(done => { console.log('done!', done);});
        //     // .pipe(
        //     //     catchError(err => {console.log('Error uploading data:', err);})
        //     // )
        // return false;

        // const httpOptions = {
        //     headers: new HttpHeaders({
        //         'Content-Type':  'application/json',
        //         // "Authorization: Bearer "$(gcloud auth application-default print-access-token) \
        //         // 'Access-Control-Allow-Origin': 'localhost:4200',
        //         // 'Authorization': 'my-auth-token',
        //     }),
        // };
        // let data = {
        //     'argument': {
        //         'sourceBucket': 'droplet-measurement-public',
        //         'sourceVideoPath': 'wp 25c sopc 178 SQE002.mp4',
        //         'targetWidth': 1952,
        //         'targetHeight': 1952,
        //         'startTimeOffsetSeconds': 10,
        //         'intervalSeconds': 60,
        //     },
        // };
        // this.http.post(executeWorkflowUrl, JSON.stringify(data), httpOptions)
        //     .subscribe(response => {console.log(response)});

        // const projectId = 'droplet-measurement-a396a';
        // const projectId = 'droplet-measurement-a396a';
        // const location = 'us-central1';
        // const {WorkflowsClient} = require('@google-cloud/workflows');
        // const client = new WorkflowsClient();
        // async function listWorkflows() {
        //   const [workflows] = await client.listWorkflows({
        //     parent: client.locationPath(projectId, location),
        //   });
        //   for (const workflow of workflows) {
        //     console.info(`name: ${workflow.name}`);
        //   }
        // }
        // listWorkflows();
        // }
        return false;
    }


    private getFiles() {
        return this.http.get(readGcsUrl);
    }

    public basename(filePath): string {
        return filePath.split(/[\/\\]/).pop();
    }

    private dirname(filePath): string {
        return filePath.substring(0, filePath.lastIndexOf('/'));
    }
}
