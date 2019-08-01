import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MatSelectionList} from '@angular/material';
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

    @ViewChild('scrollBlock', {static: false})
    scrollableBlock: ElementRef;

    clusterPanelOpenState = true;

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

    scrollListToBottom() {
        // we need to wait for loading new list of data
        setTimeout(() => {
            this.scrollableBlock.nativeElement.scrollTop = this.scrollableBlock.nativeElement.scrollHeight;
        }, 100);
    }

    getPercentageValue(cluster: ClusterModel) {
        const onePercent = cluster.totalCount / 100;
        if (onePercent !== 0) {
            return cluster.count / onePercent;
        } else {
            return 100;
        }
    }

    selectedClustersCount() {
        let num = 0;
        if (this.advancedMode) {
            for (const cluster of this.clusters) {
                if (cluster.selectMode !== ClusterSelectMode.notSelected) {
                    num ++;
                }
            }
        }
        return num;
    }

    deselectAllClusters() {
        for (const cluster of this.clusters) {
            cluster.selectMode = ClusterSelectMode.notSelected;
        }
        this.clusterSelectionDebouncer.next(null);
    }

}
