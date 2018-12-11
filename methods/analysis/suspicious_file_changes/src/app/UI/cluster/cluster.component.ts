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
    @Input('mode')
    mode = 0;
    @Output('selectionChanged')
    selectionChanged: EventEmitter<any> = new EventEmitter<any>();

    @ViewChild(MatRadioGroup)
    radioGroup: MatRadioGroup;

    constructor() {
    }

    ngOnInit() {
    }

    // emitSelectedClusters() {
    //   const selected = this.clusterList.selectedOptions.selected;
    //   const selClusters: string[] = [];
    //   for (const sel of selected) {
    //     selClusters.push(sel._text.nativeElement.innerText);
    //   }
    //   this.selectedClusters.emit(selClusters);
    // }

    nextVal(cluster) {
        if (this.mode === 0) {
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

    // radioChanged() {
    //     for (const clust of this.clusters) {
    //         clust.selectMode = ClusterSelectMode.notSelected;
    //     }
    //     this.radioGroup.selected.value.selectMode = ClusterSelectMode.added;
    //     this.selectionChanged.emit(null);
    // }

    clusterChecked(cluster) {
        return (cluster.selectMode === ClusterSelectMode.added);
    }

}
