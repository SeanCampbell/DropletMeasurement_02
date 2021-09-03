import { Component, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSelectionList, MatListOption } from '@angular/material';
import { SelectionModel } from '@angular/cdk/collections';
import { catchError } from 'rxjs/operators';

import { ChooseFileService } from './choose-file.service';


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


    @ViewChild('file', {static: true}) private fileInput: HTMLInputElement;
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

        const httpOptions = {
            headers: new HttpHeaders({
                'Content-Type':  'application/json',
                // 'Authorization: AIzaSyAtkGeuRmrsdIG-WVtrpXkUNsA4Ls0urGE',
                // "Authorization: Bearer "$(gcloud auth application-default print-access-token) \
                // 'Access-Control-Allow-Origin': 'localhost:4200',
                // 'Authorization': 'my-auth-token',
            }),
        };
        let data = {
            'argument': {
                'sourceBucket': 'droplet-measurement-public',
                'sourceVideoPath': 'wp 25c sopc 178 SQE002.mp4',
                'targetWidth': 1952,
                'targetHeight': 1952,
                'startTimeOffsetSeconds': 10,
                'intervalSeconds': 60,
            },
        };
        this.http.post(executeWorkflowUrl, JSON.stringify(data), httpOptions)
            .subscribe(response => {console.log(response)});

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
