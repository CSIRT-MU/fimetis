import {Component, Input, OnInit} from '@angular/core';
import { HttpEvent, HttpResponse} from '@angular/common/http';
import {ngf} from 'angular-file';
import {Subscription} from 'rxjs';
import {UploadService} from '../../services/upload.service';
import {ToastrService} from 'ngx-toastr';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent implements OnInit {

    files: File[] = [];
    @Input('_case')
    _case = '';
    progress: number;
    httpEmitter: Subscription;
    httpEvent: HttpEvent<{}>;
    validComboDrag = false;
    invalidComboDrag = false;
    removeDeleted = true;
    removeDeletedRealloc = true;

    constructor(private uploadService: UploadService, private toaster: ToastrService) {}

    ngOnInit() {
    }

    uploadFiles(files: File[]): Subscription {
        console.log(this.removeDeleted, this.removeDeletedRealloc);
        const formData = new FormData();

        files.forEach(file => formData.append('file', file, file.name));
        formData.append('case', this._case);
        formData.append('removeDeleted', this.removeDeleted.toString());
        formData.append('removeDeletedRealloc', this.removeDeletedRealloc.toString());
        const dataset_name = this._case;
        return this.httpEmitter = this.uploadService.upload(formData)
            .subscribe(
                event => {
                    this.httpEvent = event;
                    if (event instanceof HttpResponse) {
                        delete this.httpEmitter;
                        console.log('request done', event);
                        this.toaster.success('Import to ' + dataset_name + ' completed', 'Upload successful', {disableTimeOut: true});
                        this.files = [];
                    }
                },
                error => {
                    console.log('Uploading Error', error);
                    this.toaster.error('Error: ' + error['message'], 'Upload failed');
                }
            );
    }

}
