import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class ChooseFileService {
    private fileSource = new BehaviorSubject('');
    public currentFile = this.fileSource.asObservable();

    chooseFile(fileUrl: string) {
        this.fileSource.next(fileUrl);
    }
}
