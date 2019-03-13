import {Component, OnInit} from '@angular/core';
import {HttpClient, HttpEvent, HttpRequest, HttpResponse} from '@angular/common/http';
import {ngf} from 'angular-file';
import {Subscription} from 'rxjs';
import {environment} from '../../../environments/environment';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent implements OnInit {

    files: File[] = [];
    case = '';
    progress: number;
    url = environment.backendUrl + '/upload';
    httpEmitter: Subscription;
    httpEvent: HttpEvent<{}>;
    validComboDrag = false;
    invalidComboDrag = false;

    constructor(private httpClient: HttpClient) {}

    ngOnInit() {
    }

    uploadFiles(files: File[]): Subscription {
        const formData = new FormData();

        files.forEach(file => formData.append('file', file, file.name));
        formData.append('case', this.case);

        const req = new HttpRequest<FormData>('POST', this.url, formData, {
            reportProgress: true
        });

        return this.httpEmitter = this.httpClient.request(req)
            .subscribe(
                event => {
                    this.httpEvent = event;

                    if (event instanceof HttpResponse) {
                        delete this.httpEmitter;
                        console.log('request done', event);
                    }
                },
                error => console.log('Error Uploading', error)
            );
    }

}
