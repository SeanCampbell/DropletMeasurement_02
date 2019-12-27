import { Component, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSelectionList, MatListOption } from '@angular/material';
import { SelectionModel } from '@angular/cdk/collections';

import { ChooseFileService } from './choose-file.service';


interface ItemData {
    items: { name: string }[],
};

@Component({
  selector: 'choose-file',
  templateUrl: './choose-file.component.html',
  styles: [],
})
export class ChooseFileComponent {
    private files = new Map();
    private bucketName = 'spc-droplet-measurement-test';
    private gcsUrl = 'https://storage.googleapis.com/storage/v1/b/' + this.bucketName + '/o';
    private gcsUploadUrl = 'http://' + this.bucketName + '.storage.googleapis.com';
    private gcsUrlPrefix = 'https://storage.cloud.google.com/' + this.bucketName + '/';

    @ViewChild('fileSelection', {static: false}) public selectionList: MatSelectionList;

    constructor(private http: HttpClient, private fileService: ChooseFileService) {
        this.refreshFiles();
    }

    ngOnInit() {
        this.selectionList.selectedOptions = new SelectionModel<MatListOption>(false);
    }

    private selectionChanged() {
        const selectedFiles = this.selectionList.selectedOptions.selected.map(
            item => this.files.get(item.value));
        const selectedFile = selectedFiles[0] || '';
        this.fileService.chooseFile(selectedFile);
    }

    private basename(filePath): string {
        return filePath.split(/[\/\\]/).pop();
    }

    private getFiles() {
        return this.http.get(this.gcsUrl);
    }

    private fileNames(): string[] {
        return Array.from(this.files.keys());
    }

    private refreshFiles() {
        this.files = new Map();
        this.getFiles().subscribe((data: ItemData) => {
            data.items.forEach((item) => {
                this.files.set(item.name, this.gcsUrlPrefix + item.name); //item.selfLink);
            });
        });
    }
}
