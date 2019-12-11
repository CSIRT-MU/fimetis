import {Component, Input, OnInit} from '@angular/core';
import { HttpEvent, HttpResponse} from '@angular/common/http';
import {ngf} from 'angular-file';
import {Subscription} from 'rxjs';
import {UploadService} from '../../services/upload.service';
import {ToastrService} from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {MarkListDialogComponent} from '../dialog/mark-list-dialog/mark-list-dialog.component';
import {SelectClustersComponent} from '../dialog/select-clusters/select-clusters.component';
import {ClusterService} from '../../services/cluster.service';
import {BaseService} from '../../services/base.service';
import {SelectUsersComponent} from '../dialog/select-users/select-users.component';


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
    cluster_ids = [];
    users = [];
    readAccessIds = [];
    fullAccessIds = [];

    constructor(
        private uploadService: UploadService,
        private clusterService: ClusterService,
        private baseService: BaseService,
        private toaster: ToastrService,
        public dialog: MatDialog,
        private route: ActivatedRoute
    ) {}

    ngOnInit() {
        const case_name = this.route.snapshot.paramMap.get('case');
        if (case_name !== 'empty') {
            this._case = case_name;
        } else {
            this.getAllUsers();
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
        formData.append('cluster_ids', JSON.stringify(this.cluster_ids));
        formData.append('full_access_ids', JSON.stringify(this.fullAccessIds));
        formData.append('read_access_ids', JSON.stringify(this.readAccessIds));
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

    async selectClusters() {
        const clusters = await this.getAllClusters();

        const selected_ids = new Set();
        for (let i = 0; i < clusters.length; i++) {
            selected_ids.add(clusters[i].id);
        }

        const dialogRef = this.dialog.open(SelectClustersComponent, {
            data: {
                currentClustersIds: selected_ids,
                allClusters: clusters
            },
            minWidth: '350px',
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.cluster_ids = Array.from(result);
            }
        });
    }

    async getAllClusters() {
        return (await this.clusterService.loadClustersFromDatabase()).cluster_definitions;
    }

    async getAllUsers() {
        this.users = (await this.baseService.getAllUsers()).users;
    }

    selectAccess(access_type) {
        const dialogRef = this.dialog.open(SelectUsersComponent, {
            data: {
                allUsers: this.users
            },
            minWidth: '550px',
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (access_type === 'full-access') {
                    this.fullAccessIds = Array.from(result);
                } else {
                    this.readAccessIds = Array.from(result);
                }
            }
        });

    }
}
