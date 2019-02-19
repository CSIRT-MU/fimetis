import {Component, OnInit} from '@angular/core';
import {HttpClient, HttpEvent, HttpRequest, HttpResponse} from '@angular/common/http';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent implements OnInit {

    accept = '*';
    files: File[] = [];
    case = '';
    progress: number;
    url = 'http://127.0.0.1:5000/upload';
    hasBaseDropZoneOver: boolean = false;
    httpEmitter: Subscription;
    httpEvent: HttpEvent<{}>;
    lastFileAt: Date;
    sendableFormData: FormData;
    config = {
        url: 'http://127.0.0.1:5000/upload'
    };

    constructor(private httpClient: HttpClient) {}

    ngOnInit() {
    }

    uploadFiles(files: File[]): Subscription {
        const req = new HttpRequest<FormData>('POST', this.url, this.sendableFormData, {
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

    getDate() {
        return new Date();
    }

}
