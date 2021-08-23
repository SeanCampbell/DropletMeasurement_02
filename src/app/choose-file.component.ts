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

    @ViewChild('fileSelection', {static: true}) private selectionList: MatSelectionList;

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
