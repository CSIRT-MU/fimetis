import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MatRadioGroup, MatSelectionList} from '@angular/material';
import {ClusterModel, ClusterSelectMode} from '../../models/cluster.model';
import {debounceTime} from 'rxjs/operators';
import {Subject} from 'rxjs';

@Component({
    selector: 'app-cluster',
    templateUrl: './cluster.component.html',
    styleUrls: ['./cluster.component.css']
})
export class ClusterComponent implements OnInit {

    @ViewChild(MatSelectionList, {static: false})
    clusterList: MatSelectionList;

    @Input('clusters')
    clusters: ClusterModel[] = [];
    @Input('advancedMode')
    advancedMode = false;
    @Output('selectionChanged')
    selectionChanged: EventEmitter<any> = new EventEmitter<any>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    clusterSelectionDebouncer: Subject<any> = new Subject();
    @Output('addNewCluster')
    addNewCluster: EventEmitter<any> = new EventEmitter<any>();
    @Output('editCluster')
    editCluster: EventEmitter<ClusterModel> = new EventEmitter<ClusterModel>();


    constructor() {
        this.clusterSelectionDebouncer.pipe(debounceTime(500)).subscribe((value) => this.selectionChanged.emit(value));
    }

    ngOnInit() {
    }

    /**
     * Changes mode of given cluster by mode (mode 0: selected, not selected else: selected, not selected, deducted)
     * @param cluster Cluster model
     */
    nextVal(cluster) {
        if (!this.advancedMode) {
            for (const clust of this.clusters) {
                clust.selectMode = ClusterSelectMode.notSelected;
            }
            cluster.selectMode = ClusterSelectMode.added;
            this.clusterSelectionDebouncer.next(null);
        } else {
            cluster.selectMode = ClusterSelectMode.next(cluster.selectMode);
            if (cluster.subClusters.length > 0) {
                for (const clust of cluster.subClusters) {
                    clust.selectMode = cluster.selectMode;
                }
            }
            this.clusterSelectionDebouncer.next(null);
        }
    }

    edit(cluster) {
        this.editCluster.emit(cluster);
    }

    addCluster() {
        this.addNewCluster.emit(null);
    }

}
