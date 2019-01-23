import {Component, OnInit, ViewChild} from '@angular/core';
import {ElasticsearchService} from '../../elasticsearch.service';
import {ListViewComponent} from '../listView/listView.component';
import {MatChipList, MatDialog, MatTabGroup} from '@angular/material';
import {FilterParamModel} from '../../models/filterParam.model';
import {FilterModel} from '../../models/filter.model';
import {NameDialogComponent} from '../dialog/name-dialog/name-dialog.component';
import {ComputationModel} from '../../models/computation.model';
import {ComputationDialogComponent} from '../dialog/computation-dialog/computation-dialog.component';
import {ClusterModel} from '../../models/cluster.model';
import {ClusterManager} from '../../businessLayer/clusterManager';
import {GraphComponent} from '../graph/graph.component';
import {ComputationManager} from '../../businessLayer/computationManager';
import {GraphManager} from '../../businessLayer/graphManager';
import {BaseManager} from '../../businessLayer/baseManager';
import {ClusteringOverviewModel} from '../../models/clusteringOverview.model';
import {ElasticsearchBaseQueryManager} from '../../businessLayer/elasticsearchBaseQueryManager';
import {ConfigManager} from '../../../assets/configManager';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})

export class DashboardComponent implements OnInit {
    clusterManager: ClusterManager;
    computationManager: ComputationManager;
    baseManager: BaseManager;
    elasticsearchBaseQueryManager: ElasticsearchBaseQueryManager;

    advancedMode = false;

    /* collapse properties */
    setupWindowOpen = true;
    filterPanelOpenState = false;
    computationPanelOpenState = true;
    clusterPanelOpenState = true;
    histogramPanelOpenState = true;

    cases: any[];
    selectedCase: string;

    filters: any[];
    selectedFilter: string;
    selectedFilterModel: FilterModel = new FilterModel();
    computations: Set<ComputationModel> = new Set<ComputationModel>();
    pickedComputation: ComputationModel;
    combinedFilter: string;

    appliedFiltersKeys: Set<string> = new Set<string>();
    appliedFilters: Map<string, FilterModel> = new Map<string, FilterModel>();
    selectedAppliedFilters: Set<string> = new Set<string>();

    computedClusters: Set<string> = new Set<string>();
    selectedComputedClusters: string[] = [];
    storedClusters: Set<string> = new Set<string>();
    selectedStoredClusters: string[] = [];

    preloadedClusters: ClusterModel[] = [];
    manualClusters: ClusterModel[] = [];
    savedClusters: Set<ClusterModel> = new Set<ClusterModel>();
    clusters: Set<ClusterModel> = new Set<ClusterModel>();
    clusteringOverview: ClusteringOverviewModel[] = [];

    supportedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);
    selectedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);

    @ViewChild(ListViewComponent)
    listViewComponent: ListViewComponent;

    @ViewChild(GraphComponent)
    graphComponent: GraphComponent;

    @ViewChild(MatTabGroup)
    tabGroup: MatTabGroup;

    @ViewChild(MatChipList)
    chipList: MatChipList;

    constructor(private es: ElasticsearchService, public dialog: MatDialog) {
        this.clusterManager = new ClusterManager(this.es);
        this.computationManager = new ComputationManager(this.es);
        this.baseManager = new BaseManager(this.es);
        this.elasticsearchBaseQueryManager = new ElasticsearchBaseQueryManager();

        // test only
        //   const comp = new ComputationModel();
        //   comp.color = '#336699';
        //   comp.name = 'test';
        //   const filt = new FilterModel();
        //   filt.name = 'test_filter';
        //   filt.isSelected = true;
        //   comp.filters.add(filt);
        //   const comp2 = new ComputationModel();
        //   comp2.color = '#cc0000';
        //   comp2.name = 'test2';
        //   comp2.isSelected = false;
        //   this.computations.add(comp);
        //   this.computations.add(comp2);
        //   this.pickedComputation = comp;
    }

    ngOnInit() {
        // this.dateSliderComponent.min = 0;
        // this.dateSliderComponent.max = 100;
        this.listViewComponent.displayedClusters = this.selectedStoredClusters;
        this.graphComponent._clusters = this.getClusters();
        this.listViewComponent.clusters = this.getClusters();

        this.baseManager.getCases().then(
            response => {
                this.cases = response;
            }, error => {
                console.error(error);
            }).then(() => {
            console.log('Show Cases completed!');
        });

        this.baseManager.getFilters().then(
            response => {
                this.filters = response;
            }, error => {
                console.error(error);
            }).then(() => {
            console.log('Show Filters completed!');
        });
        this.collapse();
    }

    addNewFilterButton() {
        this.filterPanelOpenState = true;
        this.tabGroup.selectedIndex = 0;
    }

    /**
     * Method triggered by selecting Case
     */
    selectedCaseChanged() {
        this.setupWindowOpen = false;
        this.listViewComponent.case = this.selectedCase;
        this.listViewComponent.displayedClusters = [];
        this.clusterManager.case = this.selectedCase;
        this.computationManager.case = this.selectedCase;
        this.initPreLoadedClusters();
        // this.loadStoredClusters();
        this.clusteringOverview = this.computationManager.getPreloadedClusterings();
        this.listViewComponent.init();
    }

    /**
     * Loads stored clusters from db
     */
    loadStoredClusters() {
        this.clusterManager.getStoredClusters().then(
            response => {
                this.savedClusters = response;
            });
    }

    /**
     * Method to initialize predefined clusters
     * @returns {Promise<void>} Returns predefined clusters
     */
    async initPreLoadedClusters() {
        // preloaded clusters
        this.computationManager.computations = [];
        this.preloadedClusters = [];


        const configManager = new ConfigManager();

        const preparedComputationsFromJson = configManager.loadPreparedComputations()['prepared_computations'];

        for (let i = 0; i < preparedComputationsFromJson.length; i++) {
            const tmpComputation = new ComputationModel();
            tmpComputation.name = preparedComputationsFromJson[i]['name'];
            tmpComputation.color = preparedComputationsFromJson[i]['color'];
            tmpComputation.isSelected = preparedComputationsFromJson[i]['isSelected'];
            tmpComputation.description = preparedComputationsFromJson[i]['description'];
            tmpComputation.filters = new Set(preparedComputationsFromJson[i]['filters']);
            this.computationManager.addComputation(tmpComputation);

        }

        this.preloadedClusters = this.preloadedClusters.concat(this.computationManager.getClusters());
    }

    /**
     * Method returns all clusters
     * @returns {ClusterModel[]} Returns all actual clusters
     */
    getClusters() {
        return this.preloadedClusters.concat(this.manualClusters).concat(Array.from(this.clusters)).concat(Array.from(this.savedClusters));
    }

    /* Loads filter from database */
    async loadFilter() {
        this.baseManager.getFilterByName(this.selectedFilter)
            .then(
            result => {
                this.selectedFilterModel = result;
            }
        );
    }


    /**
     * Applies selected filter with inserted parameters
     */
    useFilter() {
        // if (this.selectedFilter == null) {
        //   this.combineSelectedFilters();
        // } else {
        //   this.selectedFilterModel.completed = this.fs.applyFilter(this.selectedFilterModel.json, this.selectedFilterModel.params);
        //   for (const oneParam of this.selectedFilterModel.params) {
        //     this.selectedFilterModel.name = this.selectedFilterModel.name + '-' + oneParam.name + ':' + oneParam.value;
        //   }
        //   // // copy object without reference
        //   // const copy = JSON.parse(JSON.stringify(this.selectedFilterModel));
        //   // this.appliedFilters.set(this.selectedFilterModel.name, copy);
        //   // this.selectedAppliedFilters.add(this.selectedFilterModel.name);
        //   // this.appliedFiltersKeys.add(this.selectedFilterModel.name);
        //   // this.combineSelectedFilters();
        // }
        if (this.pickedComputation != null) {
            if (!this.pickedComputation.filters.has(this.selectedFilterModel)) {
                this.selectedFilterModel.isSelected = true;
                this.pickedComputation.filters.add(this.selectedFilterModel);
            }
        }
        this.selectedFilterModel = new FilterModel();
        this.selectedFilter = null;
    }

    /**
     * De/select given filter in computation
     * @param filter Filter model
     */
    selectFilter(filter) {
        if (this.selectedAppliedFilters.has(filter)) {
            this.selectedAppliedFilters.delete(filter);
        } else {
            this.selectedAppliedFilters.add(filter);
        }
        this.combineSelectedFilters();
        console.log(this.selectedAppliedFilters);
    }

    combineSelectedFilters() {
        let clusterName = 'cluster';
        let resFilter = '';
        this.selectedAppliedFilters.forEach((value) => {
            console.log(value);
            resFilter = this.elasticsearchBaseQueryManager.getFilterCombination([resFilter, this.appliedFilters.get(value).completed]);
            console.log(this.appliedFilters.get(value));
            clusterName = clusterName + '-' + value;
        });

        if (this.selectedAppliedFilters.size > 0) {
            this.combinedFilter = resFilter;
        } else {
            this.combinedFilter = null;
        }
        console.log(resFilter);
        this.listViewComponent.case = this.selectedCase;
        this.listViewComponent.filter = this.combinedFilter;
        this.listViewComponent.displayedClusters = this.selectedStoredClusters;
        this.listViewComponent.computations = Array.from(this.computations);
        this.listViewComponent.init();

        // TODO WARNING - only one cluster at a time
        this.computedClusters.clear();
        if (this.selectedAppliedFilters.size > 0) {
            this.computedClusters.add(clusterName);
            this.selectedComputedClusters = [];
            this.selectedComputedClusters.push(clusterName);
        }
    }

    setComputedClusters($event) {
        this.selectedComputedClusters = $event;
        if (this.selectedComputedClusters.length > 0) {
            this.listViewComponent.filter = this.combinedFilter;
            this.listViewComponent.init();
        } else {
            this.listViewComponent.filter = null;
            this.listViewComponent.init();
        }
    }

    /**
     * Triggered by changing mode of clusters (select, deselect, deduct)
     */
    clusterSelectionChanged($event) {
        console.log(this.clusters);
        this.listViewComponent.clusters = this.getClusters();
        this.graphComponent._clusters = this.getClusters();
        this.listViewComponent.init();
        this.graphComponent.init();
        // this.setDateSliderBoundary();
    }

    setStoredClusters($event) {
        this.selectedStoredClusters = $event;
        this.listViewComponent.displayedClusters = this.selectedStoredClusters;
        this.listViewComponent.init();
    }

    /**
     * Store selected cluster to persistent db
     */
    // TODO save more tags - now only one combined filter is used - solved in cluster manager method (need to test it)
    storeSelectedClusters() {
        console.log('store');
        for (const cluster of this.selectedComputedClusters) {
            this.es.addTag(
                this.selectedCase,
                this.combinedFilter,
                cluster
            ).then(
                response => {
                    if (response.failures.length < 1) {
                        console.log('No failures', response.failures);
                    }
                }, error => {
                    console.error(error);
                }).then(() => {
                console.log('Tag saved');
            });
            console.log(this.storedClusters);
            this.storedClusters.add(cluster.toString());
        }
    }

    /**
     * Remove selected cluster from persistent db if possible
     */
    deleteSelectedStoredClusters() {
        this.listViewComponent.displayedClusters = [];
        this.listViewComponent.init();
        for (const cluster of this.selectedStoredClusters) {
            this.es.removeTag(
                this.selectedCase,
                this.combinedFilter,
                this.selectedStoredClusters,
                cluster
            ).then(
                response => {
                    this.storedClusters.delete(cluster);
                    if (response.failures.length < 1) {
                        console.log('No failures', response.failures);
                    } else {
                        console.log(response);
                    }
                }, error => {
                    console.error(error);
                }).then(() => {
                console.log('Tag removed');
            });
        }
    }

    /**
     * Creates cluster by selection in list view
     */
    createClusterFromSelection() {
        const namePrefix = 'custom-';
        const dialogRef = this.dialog.open(NameDialogComponent, {
            width: '350px',
            data: {
                title: 'Create new cluster',
                itemsNumber: this.listViewComponent.tableSelection.selected.length,
                placeholder: 'Type new cluster\'s name'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            console.log('dialog closed', result);
            if (result != null) {
                const params = [];
                const values = [];
                for (let index = 0; index < this.listViewComponent.tableSelection.selected.length; index++) {
                    params.push('_id');
                    values.push(this.listViewComponent.tableSelection.selected[index]._id);
                }
                let filter = this.elasticsearchBaseQueryManager.buildShouldMatchFilter(params, values);
                console.log(filter);
                filter = ',' + filter;
                this.es.addTag(
                    this.selectedCase,
                    filter,
                    (namePrefix + result)
                ).then(
                    response => {
                        if (response.failures.length < 1) {
                            console.log('No failures', response.failures);
                        }
                    }, error => {
                        console.error(error);
                    }).then(() => {
                    console.log('Tag saved');
                });
                this.storedClusters.add((namePrefix + result));
                this.listViewComponent.tableSelection.clear();
            }
        });
    }

    /**
     * Creates filter by selection in list view
     */
    createFilterFromSelection() {
        const dialogRef = this.dialog.open(NameDialogComponent, {
            width: '350px',
            data: {
                title: 'Create new filter',
                itemsNumber: this.listViewComponent.tableSelection.selected.length,
                placeholder: 'Type new filter\'s name'
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            console.log('dialog closed', result);
            if (result != null) {
                const params = [];
                const values = [];
                const filterParams = [];
                for (let index = 0; index < this.listViewComponent.tableSelection.selected.length; index++) {
                    params.push('_id');
                    values.push(this.listViewComponent.tableSelection.selected[index]._id);
                    const filParam = new FilterParamModel();
                    filParam.name = '_id';
                    filParam.value = this.listViewComponent.tableSelection.selected[index]._id;
                    filterParams.push(filParam);
                }
                const filter = this.elasticsearchBaseQueryManager.buildShouldMatchFilter(params, values);
                const model = new FilterModel();
                model.name = result;
                model.completed = filter;
                model.params = filterParams;
                model.json = filter;
                this.appliedFilters.set(model.name, model);
                this.selectedAppliedFilters.add(model.name);
                this.appliedFiltersKeys.add(model.name);
                this.listViewComponent.tableSelection.clear();
                this.combineSelectedFilters();
            }
        });
    }

    /**
     * If graph boundaries has changed this method tries to fill boundaries into filter params called FROM and TO
     * @param $event Graph emit event
     */
    changeDateBoundary($event) {
        console.log($event, 'dashboard');
        if ($event[0] !== undefined || $event[1] !== undefined) {
            for (const param of this.selectedFilterModel.params) {
                if (param.type === 'DATE') {
                    if (param.name === 'FROM') {
                        param.value = $event[0].split('.')[0].replace(' ', 'T');
                    }
                    if (param.name === 'TO') {
                        param.value = $event[1].split('.')[0].replace(' ', 'T');
                    }
                }
            }
            this.listViewComponent.timeRangeFilter(new Date($event[0]).toISOString(), new Date($event[1]).toISOString());
        }
    }

    /**
     * Adds new computation
     */
    addComputation() {
        const dialogRef = this.dialog.open(ComputationDialogComponent, {
            width: '350px',
            data: {
                title: 'Create new clustering',
                namePlaceholder: 'Type new clustering\'s name',
                colorPlaceHolder: 'Select clustering color'
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            console.log('computation dialog closed', result);
            if (result != null) {
                const comp = new ComputationModel();
                comp.name = result[0];
                comp.color = result[1];
                this.computations.add(comp);
            }
        });
    }

    /**
     * Adds filter to given computation
     * @param computation Computation to add new filter to
     */
    addFilter(computation) {
        this.filterPanelOpenState = true;
        this.pickedComputation = computation;
        console.log(this.pickedComputation);
    }

    /**
     * Method to drag and drop filters between computations
     * @param $event
     * @param {FilterModel} filter
     * @param {ComputationModel} computation
     */
    dragFilter($event, filter: FilterModel, computation: ComputationModel) {
        $event.dataTransfer.setData('filter', JSON.stringify(filter));
        $event.dataTransfer.dropEffect = 'copy';
        $event.effectAllowed = 'copyMove';
    }

    /**
     * Method to drag and drop filters between computations
     * @param $event Drag event
     */
    dragOver($event) {
        $event.preventDefault();
    }

    /**
     * Method to drag and drop filters between computations
     * @param $event Drop event
     * @param {ComputationModel} computation Target computation
     */
    dropFilter($event, computation: ComputationModel) {
        console.log('dropped', computation);
        $event.preventDefault();
        const filter = JSON.parse($event.dataTransfer.getData('filter'));
        console.log('filter', filter);
        computation.filters.add(filter);
    }

    elementResized($event) {
        console.log($event, 'resized');
    }

    /**
     * Delete given filter from given computation
     * @param {FilterModel} filter Filter model
     * @param {ComputationModel} computation Computation to delete filter from
     */
    deleteFilter(filter: FilterModel, computation: ComputationModel) {
        computation.filters.delete(filter);
    }

    /**
     * Edit given filter of given computation
     * @param {FilterModel} filter
     * @param {ComputationModel} computation
     */
    editFilter(filter: FilterModel, computation: ComputationModel) {
        this.selectedFilterModel = filter;
        this.pickedComputation = computation;
        this.selectedFilter = filter.name;
        this.filterPanelOpenState = true;
        this.collapse();
    }

    /**
     * Copy given filter
     * @param {FilterModel} filter
     */
    copyFilter(filter: FilterModel) {
        this.selectedFilterModel = JSON.parse(JSON.stringify(filter));
        this.selectedFilter = this.selectedFilterModel.name;
        this.filterPanelOpenState = true;
        this.collapse();
    }

    /**
     * Compute clusters from all computations
     */
    computeComputations() {
        console.log('compute');
        this.computationManager.case = this.selectedCase;
        this.computationManager.computations = Array.from(this.computations);
        this.clusteringOverview = this.computationManager.getClusterings();
        const clusters = this.computationManager.getClusters();
        this.clusters.clear();
        for (const cluster of clusters) {
            this.clusters.add(cluster);
            console.log('added/', cluster);
        }
    }

    /**
     * Compute clusters from given computation
     * @param {ComputationModel} computation
     */
    // TODO method that computes clustering overview only for selected computation
    computeSelectedComputation(computation: ComputationModel) {
        console.log(computation);
        this.computeComputations();
    }

    /**
     * Triggered by collapse of any element and computes height of each element
     */
    collapse() {
        console.log(this.filterPanelOpenState);
        // let height = 10;
        let height = 47;
        if (!this.filterPanelOpenState) {
            height += 20;
        }
        if (this.computationPanelOpenState) {
            let index = 0;
            height -= 2;
            while (index < this.computations.size) {
                height -= 2;
                index++;
            }
        }
        if (!this.histogramPanelOpenState) {
            height += 20;
        }
        this.listViewComponent.resizeList(height);
    }

    makeManualCluster(computation: ComputationModel) {
        console.log('comp', computation);
        this.computationManager.computations = [];
        this.computationManager.addComputation(computation);
        this.manualClusters = this.manualClusters.concat(this.computationManager.getClusters());
    }

    /**
     * Triggered by state change of one of the type checkboxes
     * @param type Type that changed state (select / deselect)
     */
    typeCheckboxChanged(type) {
        if (this.selectedTypes.has(type)) {
            this.selectedTypes.delete(type);
        } else {
            this.selectedTypes.add(type);
        }
        console.log(type, this.selectedTypes);
        this.listViewComponent.typeFilter(this.selectedTypes);
        this.graphComponent.showHideTrace(type);
    }

    selectedMetadataTypesChanged(selectedTypes: Set<string>) {
        this.selectedTypes = selectedTypes;
        this.listViewComponent.typeFilter(this.selectedTypes);
    }

    /**
     * Trigered by change of additional filters (searching, date slider etc.) in list view
     * @param {Map<string, string>} filters
     */
    additionalFiltersChanged(filters: Map<string, string>) {
        // filters.delete('searchString');
        const clustManager = new ClusterManager(this.es);
        clustManager.clusters = this.getClusters();
        clustManager.case = this.selectedCase;
        clustManager.countEntriesOfClusters(Array.from(filters.values()));
    }
}
