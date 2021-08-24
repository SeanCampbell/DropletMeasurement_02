import { Component, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSelectionList, MatListOption } from '@angular/material';
import { SelectionModel } from '@angular/cdk/collections';

import { ChooseFileService } from './choose-file.service';


interface ItemData {
    items: { name: string }[],
};

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
                console.log('item', item);
                this.files.set(this.dirname(item.name), readGcsUrlPrefix + item.name); //this.dirname(item.name)); //item.selfLink);
            });
        });
    }

    public upload() {
        // console.log('uploading!!!')
        // this.http.post(writeGcsUrlPrefix);

        return true;
    // curl -X POST --data-binary @OBJECT_LOCATION \
    //     -H "Authorization: Bearer OAUTH2_TOKEN" \
    //     -H "Content-Type: OBJECT_CONTENT_TYPE" \
    //     "https://storage.googleapis.com/upload/storage/v1/b/BUCKET_NAME/o?uploadType=media&name=OBJECT_NAME"
    //     <form #fileForm [action]="writeGcsUrlPrefix" method="post" enctype="multipart/form-data">
    //         <input type="text" name="key" [value]="basename(file.value)" />
    //         <input #file name="file" type="file" />
    //         <button mat-raised-button color="primary" type="submit" (click)="fileForm.submit()">UPLOAD</button><br />
    //         <table>
    //             <tr><td><label>Start time</label></td><td><input type="number" value="0" /> seconds</td>
    //             <tr><td><label>Time interval</label></td><td><input type="number" value="5" /> seconds</td>
    //         </table>
    //     </form>
    }
    // curl -X POST \
    //     -H "Content-Type: OBJECT_CONTENT_TYPE" \
    //     "https://storage.googleapis.com/upload/storage/v1/b/droplet-measurement-public/o?uploadType=media&name=OBJECT_NAME"

        // https://droplet-measurement-public.storage.googleapis.com/


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
