import {Component, OnInit} from '@angular/core';
import {HttpClient, HttpEvent, HttpRequest, HttpResponse} from '@angular/common/http';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent implements OnInit {

    files: File[] = [];
    case = '';
    progress: number;
    url = 'http://127.0.0.1:5000/upload';
    httpEmitter: Subscription;
    httpEvent: HttpEvent<{}>;

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
