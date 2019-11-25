import {Component, Input, OnInit} from '@angular/core';
import { HttpEvent, HttpResponse} from '@angular/common/http';
import {ngf} from 'angular-file';
import {Subscription} from 'rxjs';
import {UploadService} from '../../services/upload.service';
import {ToastrService} from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent implements OnInit {

    files: File[] = [];
    @Input('_case')
    _case = '';
    _description = '';
    progress: number;
    httpEmitter: Subscription;
    httpEvent: HttpEvent<{}>;
    validComboDrag = false;
    invalidComboDrag = false;
    removeDeleted = true;
    removeDeletedRealloc = true;

    constructor(private uploadService: UploadService, private toaster: ToastrService, private route: ActivatedRoute) {}

    ngOnInit() {
        const case_name = this.route.snapshot.paramMap.get('case');
        if (case_name !== 'empty') {
            this._case = case_name;
        }
    }

    uploadFiles(files: File[]): Subscription {
        console.log(this.removeDeleted, this.removeDeletedRealloc);
        const formData = new FormData();

        files.forEach(file => formData.append('file', file, file.name));
        formData.append('case', this._case);
        formData.append('description', this._description);
        formData.append('removeDeleted', this.removeDeleted.toString());
        formData.append('removeDeletedRealloc', this.removeDeletedRealloc.toString());
        formData.append('datasetExtend', this.datasetExtended().toString());
        const case_name = this.route.snapshot.paramMap.get('case');

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

    datasetExtended() {
        return this.route.snapshot.paramMap.get('case') !== 'empty';
    }

}
