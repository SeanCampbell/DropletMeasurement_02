import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatCard } from '@angular/material/card';
import { MatSelectionList, MatListOption } from '@angular/material/list';
import { SelectionModel } from '@angular/cdk/collections';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { catchError } from 'rxjs/operators';

import { ChooseFileService } from './choose-file.service';

import { connectFunctionsEmulator } from 'firebase/functions';


const firebaseConfig = {
    // TODO: DELETE THIS BEFORE COMMITTING.
    authDomain: 'droplet-measurement-a396a.firebaseapp.com',
    databaseURL: 'https://droplet-measurement-a396a.firebaseio.com',
    projectId: 'droplet-measurement-a396a',
    storageBucket: 'droplet-measurement-a396a.appspot.com',
    messagingSenderId: '283281649775',
    appId: '1:283281649775:web:0251413ef72a12cf3b1d9a',
    measurementId: 'G-C43CYQP4V0',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage();
const functions = getFunctions(app);
connectFunctionsEmulator(functions, 'localhost', 5001);


interface ItemData {
    items: { name: string }[],
};

const executeWorkflowUrl = 'https://workflowexecutions.googleapis.com/v1beta/projects/droplet-measurement-309203/locations/us-central1/workflows/video-processor/executions';
// const readBucketName = 'droplet-measurement-processed-public';
const readBucketName = 'droplet-measurement-processed';
// const writeBucketName = 'droplet-measurement-public';
const writeBucketName = 'droplet-measurement-a396a.appspot.com';
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
    @ViewChild('startTime', {static: true}) private startTime: ElementRef;
    @ViewChild('timeInterval', {static: true}) private timeInterval: ElementRef;
    @ViewChild('uploadProgress', {static: true}) private uploadProgress: ElementRef;

    constructor(private http: HttpClient, private fileService: ChooseFileService,
                private renderer: Renderer2) {
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
        // console.log('fileInput', file);
        const storageRef = ref(storage, file.name);
        const uploadTask = uploadBytesResumable(storageRef, file); //, metadata);

        // Listen for state changes, errors, and completion of the upload.
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            this.renderer.setProperty(this.uploadProgress.nativeElement, 'innerHTML', progress.toFixed(1) + '%');
            switch (snapshot.state) {
              case 'paused':
                console.log('Upload is paused');
                break;
              case 'running':
                console.log('Upload is running');
                break;
            }
          },
          (error) => {
            // A full list of error codes is available at
            // https://firebase.google.com/docs/storage/web/handle-errors
            switch (error.code) {
              case 'storage/unauthorized':
                // User doesn't have permission to access the object
                break;
              case 'storage/canceled':
                // User canceled the upload
                break;

              // ...

              case 'storage/unknown':
                // Unknown error occurred, inspect error.serverResponse
                break;
            }
          },
          () => {
              const main = httpsCallable(functions, 'main');
              main({
                  sourceBucket: writeBucketName,
                  sourceVideoPath: file.name,
                  // TODO: Calculate these dynamically.
                  targetWidth: 1920,
                  targetHeight: 1920,
                  startTimeOffsetSeconds: parseInt(this.startTime.nativeElement.value),
                  intervalSeconds:  parseInt(this.timeInterval.nativeElement.value),
              }).then((result) => {
                  const data = result.data;
                  console.log(data);
              });
          }
        );

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
