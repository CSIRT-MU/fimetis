import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MatRadioGroup, MatSelectionList} from '@angular/material';
import {ClusterModel, ClusterSelectMode} from '../../models/cluster.model';
import {ClusteringOverviewModel} from '../../models/clusteringOverview.model';

@Component({
    selector: 'app-cluster',
    templateUrl: './cluster.component.html',
    styleUrls: ['./cluster.component.css']
})
export class ClusterComponent implements OnInit {

    @ViewChild(MatSelectionList)
    clusterList: MatSelectionList;

    @Input('clusteringOverview')
    clusteringOverview: ClusteringOverviewModel[] = [];
    @Input('clusters')
    clusters: ClusterModel[] = [];
    @Input('advancedMode')
    advancedMode = false;
    @Output('selectionChanged')
    selectionChanged: EventEmitter<any> = new EventEmitter<any>();
    @Output('addNewCluster')
    addNewCluster: EventEmitter<any> = new EventEmitter<any>();
    @Output('editCluster')
    editCluster: EventEmitter<ClusterModel> = new EventEmitter<ClusterModel>();


    constructor() {
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
            this.selectionChanged.emit(null);
        } else {
            cluster.selectMode = ClusterSelectMode.next(cluster.selectMode);
            if (cluster.subClusters.length > 0) {
                for (const clust of cluster.subClusters) {
                    clust.selectMode = cluster.selectMode;
                }
            }
            this.selectionChanged.emit(null);
        }
    }

    edit(cluster) {
        this.editCluster.emit(cluster);
    }

    addCluster() {
        this.addNewCluster.emit(null);
    }

}
