import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {ClusterModel} from '../../models/cluster.model';
import {FilterModel} from '../../models/filter.model';
import {BaseService} from '../../services/base.service';
import {ToastrService} from 'ngx-toastr';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.css']
})
export class FilterComponent implements OnInit {
    
    @Input('inputCluster')
    inputCluster: ClusterModel;
    filters: any[];
    selectedFilter: string;
    filterPanelOpenState = false;
    selectedFilterModel: FilterModel = new FilterModel();
    @Output('editDone')
    editDone: EventEmitter<ClusterModel> = new EventEmitter<ClusterModel>();
    
    constructor(private baseService: BaseService,
                private toaster: ToastrService) { }
    
    ngOnInit() {
    }

    loadAllFilters() {
        this.baseService.getFilters().then(
            response => {
                this.filters = response.filters;
            }, error => {
                console.error(error);
            }).then(() => {
            console.log('Show Filters completed!');
        });
    }

    /* Loads filter from database */
    async loadFilter() {
        this.baseService.getFilterByName(this.selectedFilter)
            .then(
                result => {
                    this.selectedFilterModel = result;
                }, error => {
                    console.log('Loading filter by name - error', error);
                    this.toaster.error(error.message, 'Cannot load filter');
                }
            );
    }


    /**
     * Applies selected filter with inserted parameters
     */
    useFilter() {
        if (this.inputCluster != null) {
            if (this.inputCluster.filters.indexOf(this.selectedFilterModel) < 0) {
                this.selectedFilterModel.isSelected = true;
                this.inputCluster.filters.push(this.selectedFilterModel);
            }
        }
        this.selectedFilterModel = new FilterModel();
        this.selectedFilter = null;
        this.filterPanelOpenState = false;
    }
    
    /**
     * Adds filter to given cluster
     * @param cluster Cluster to add new filter to
     */
    addFilter(cluster: ClusterModel) {
        this.filterPanelOpenState = true;
        this.inputCluster = cluster;
        console.log('add filter to: ', this.inputCluster);
    }
    
    /**
     * Method to drag and drop filters between clusters
     * @param $event
     * @param {FilterModel} filter
     * @param {ClusterModel} cluster
     */
    dragFilter($event, filter: FilterModel, cluster: ClusterModel) {
        $event.dataTransfer.setData('filter', JSON.stringify(filter));
        $event.dataTransfer.dropEffect = 'copy';
        $event.effectAllowed = 'copyMove';
    }
    
    /**
     * Method to drag and drop filters between clusters
     * @param $event Drag event
     */
    dragOver($event) {
        $event.preventDefault();
    }
    
    /**
     * Method to drag and drop filters between clusters
     * @param $event Drop event
     * @param {ClusterModel} cluster Target computation
     */
    dropFilter($event, cluster: ClusterModel) {
        console.log('dropped', cluster);
        $event.preventDefault();
        const filter = JSON.parse($event.dataTransfer.getData('filter'));
        console.log('filter', filter);
        // computation.filters.add(filter);
        cluster.filters.push(filter);
    }
    
    /**
     * Delete given filter from given cluster
     * @param {FilterModel} filter Filter model
     * @param {ClusterModel} cluster Cluster to delete filter from
     */
    deleteFilter(filter: FilterModel, cluster: ClusterModel) {
        const index = cluster.filters.indexOf(filter);
        if (index !== -1) {
            cluster.filters.splice(index, 1);
        }
        // computation.filters.delete(filter);
    }
    
    /**
     * Edit given filter of given cluster
     * @param {FilterModel} filter
     * @param {ClusterModel} cluster
     */
    editFilter(filter: FilterModel, cluster: ClusterModel) {
        this.selectedFilterModel = filter;
        this.inputCluster = cluster;
        this.selectedFilter = filter.name;
        this.filterPanelOpenState = true;
    }
    
    /**
     * Copy given filter
     * @param {FilterModel} filter
     */
    copyFilter(filter: FilterModel) {
        this.selectedFilterModel = JSON.parse(JSON.stringify(filter));
        this.selectedFilter = this.selectedFilterModel.name;
        this.filterPanelOpenState = true;
    }

    editClusterDone(){
        this.editDone.emit(this.inputCluster);
    }
}
