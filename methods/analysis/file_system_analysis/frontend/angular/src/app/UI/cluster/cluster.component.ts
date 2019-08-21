import {Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {MatDialog, MatSelectionList} from '@angular/material';
import {ClusterModel, ClusterSelectMode} from '../../models/cluster.model';
import {debounceTime} from 'rxjs/operators';
import {Subject, Subscription} from 'rxjs';
import {StateService} from '../../services/state.service';
import {ComputationDialogComponent} from '../dialog/computation-dialog/computation-dialog.component';
import {ClusterService} from '../../services/cluster.service';

@Component({
    selector: 'app-cluster',
    templateUrl: './cluster.component.html',
    styleUrls: ['./cluster.component.css']
})
export class ClusterComponent implements OnInit, OnDestroy {

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
    private subscriptions: Subscription[] = [];

    constructor(private stateService: StateService,
                private dialog: MatDialog,
                private clusterService: ClusterService) {
        // this.clusterSelectionDebouncer.pipe(debounceTime(500)).subscribe((value) => this.selectionChanged.emit(value));
        this.subscriptions.push(this.clusterSelectionDebouncer.pipe(debounceTime(500)).subscribe((value) => this.stateService.clusters = value));
        this.subscriptions.push(this.stateService.currentStateClusters.subscribe((value) => this.clusters = value));
        this.subscriptions.push(this.stateService.currentStateAdditionalFilters.subscribe((value) => this.computeClustersItemCount(value)));
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
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
            this.clusterSelectionDebouncer.next(this.clusters);
        } else {
            cluster.selectMode = ClusterSelectMode.next(cluster.selectMode);
            if (cluster.subClusters.length > 0) {
                for (const clust of cluster.subClusters) {
                    clust.selectMode = cluster.selectMode;
                }
            }
            this.clusterSelectionDebouncer.next(this.clusters);
        }
    }

    edit(cluster) {
        this.editCluster.emit(cluster);
    }

    addCluster() {
        // this.addNewCluster.emit(null);
        const dialogRef = this.dialog.open(ComputationDialogComponent, {
            width: '350px',
            data: {
                title: 'Create new cluster',
                namePlaceholder: 'Type new cluster\'s name',
                colorPlaceHolder: 'Select cluster color'
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            console.log('cluster dialog closed', result);
            if (result != null) {
                const cluster = new ClusterModel();
                cluster.name = result[0];
                cluster.color = result[1];
                cluster.count = 0;
                cluster.totalCount = 0;
                this.stateService.addCluster(cluster);
                this.editCluster.emit(cluster);
                this.scrollListToBottom();
            }
        });

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
            if (cluster.count > 0) {
                return Math.max(1, cluster.count / onePercent);
            } else {
                return 0;
            }
        } else {
            // if total is zero
            return 0;
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

    computeClustersItemCount(additionalFilters: object) {
        this.clusterService.countEntriesOfClusters(this.stateService.selectedCase, this.clusters, additionalFilters);
    }

}
