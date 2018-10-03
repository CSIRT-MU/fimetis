import {Component, OnInit, ViewChild} from '@angular/core';
import {ElasticsearchService} from '../../elasticsearch.service';
import {ListViewComponent} from '../listView/listView.component';
import {MatChipList, MatDialog, MatTabGroup} from '@angular/material';
import {FilterService} from '../../filter.service';
import {FilterParamModel} from '../../models/filterParam.model';
import {FilterModel} from '../../models/filter.model';
import { NameDialogComponent } from '../dialog/name-dialog/name-dialog.component';
import {ComputationModel} from '../../models/computation.model';
import {ComputationDialogComponent} from '../dialog/computation-dialog/computation-dialog.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  index = 'metadata';
  type = '';
  filterIndex = 'filter';
  filterType = '';

  filterPanelOpenState = true;
  computationPanelOpenState = true;

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

  @ViewChild(ListViewComponent)
  metadataView: ListViewComponent;

  @ViewChild(MatTabGroup)
  tabGroup: MatTabGroup;

  @ViewChild(MatChipList)
  chipList: MatChipList;

  constructor(private es: ElasticsearchService, private fs: FilterService, public dialog: MatDialog) {
      // test only
      const comp = new ComputationModel();
      comp.color = '#336699';
      comp.name = 'test';
      const filt = new FilterModel();
      filt.name = 'new';
      filt.isSelected = true;
      comp.filters.add(filt);
      const comp2 = new ComputationModel();
      comp2.color = '#cc0000';
      comp2.name = 'test2';
      this.computations.add(comp);
      this.computations.add(comp2);
      this.pickedComputation = comp;
  }

  ngOnInit() {
    this.metadataView.displayedClusters = this.selectedStoredClusters;
    this.es.getCases(
      this.index,
      this.type
    ).then(
      response => {
        this.cases = response.aggregations.cases.buckets;
        console.log(response);
        console.log(this.cases);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Show Cases Completed!');
    });
    this.es.getFilters(
      this.filterIndex,
      this.filterType,
    ).then(
      response => {
        this.filters = response.aggregations.filters.buckets;
        console.log(response);
        console.log(this.filters);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Show Filters Completed!');
    });
  }

  addNewFilterButton() {
    this.filterPanelOpenState = true;
    this.tabGroup.selectedIndex = 0;
  }

  selectedCaseChanged() {
    this.metadataView.case = this.selectedCase;
    this.metadataView.displayedClusters = [];
    this.metadataView.init();
    this.loadStoredClusters();
  }

  loadStoredClusters() {
    this.es.getTags(
      this.index,
      this.type,
      this.selectedCase
    ).then(
      response => {
        this.storedClusters = new Set<string>(response.aggregations.tags.buckets);
        console.log(response);
        console.log(this.storedClusters);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Show Tags Completed!');
    });
  }

  loadFilter() {
    this.es.getFilterByName(
      this.filterIndex,
      this.filterType,
      this.selectedFilter
    ).then(
      response => {
        const test = response.hits.hits;
        this.selectedFilterModel = response.hits.hits[0]._source;
        console.log(test);
        console.log(this.selectedFilterModel);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Filter loaded');
    });
  }

  useFilter() {
    if (this.selectedFilter == null) {
      this.combineSelectedFilters();
    } else {
      this.selectedFilterModel.completed = this.fs.applyFilter(this.selectedFilterModel.json, this.selectedFilterModel.params);
      for (const oneParam of this.selectedFilterModel.params) {
        this.selectedFilterModel.name = this.selectedFilterModel.name + '-' + oneParam.name + ':' + oneParam.value;
      }
      // copy object without reference
      const copy = JSON.parse(JSON.stringify(this.selectedFilterModel));
      this.appliedFilters.set(this.selectedFilterModel.name, copy);
      this.selectedAppliedFilters.add(this.selectedFilterModel.name);
      this.appliedFiltersKeys.add(this.selectedFilterModel.name);
      this.combineSelectedFilters();
      // computations
      if (this.pickedComputation != null) {
          console.log(this.pickedComputation, this.selectedFilterModel, 'what is wrong');
          this.pickedComputation.filters.add(this.selectedFilterModel);
      }
      this.selectedFilterModel = new FilterModel();
      this.selectedFilter = null;
    }
  }

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
      resFilter = this.fs.getFilterCombination([resFilter, this.appliedFilters.get(value).completed]);
      console.log(this.appliedFilters.get(value));
      clusterName = clusterName + '-' + value;
    });
    if (this.selectedAppliedFilters.size > 0) {
      this.combinedFilter = resFilter;
    } else {
      this.combinedFilter = null;
    }
    console.log(resFilter);
    this.metadataView.index = this.index;
    this.metadataView.type = this.type;
    this.metadataView.case = this.selectedCase;
    this.metadataView.filter = this.combinedFilter;
    this.metadataView.displayedClusters = this.selectedStoredClusters;
    this.metadataView.init();

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
      this.metadataView.filter = this.combinedFilter;
      this.metadataView.init();
    } else {
      this.metadataView.filter = null;
      this.metadataView.init();
    }
  }

  setStoredClusters($event) {
    this.selectedStoredClusters = $event;
    this.metadataView.displayedClusters =  this.selectedStoredClusters;
    this.metadataView.init();
  }

  // TODO save more tags - now only one combined filter is used
  storeSelectedClusters() {
    console.log('store');
    for (const cluster of this.selectedComputedClusters) {
      this.es.addTag(
        this.index,
        this.type,
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

  deleteSelectedStoredClusters() {
    this.metadataView.displayedClusters = [];
    this.metadataView.init();
    for (const cluster of this.selectedStoredClusters) {
      this.es.removeTag(
        this.index,
        this.type,
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

  createClusterFromSelection() {
    const namePrefix = 'custom-';
    const dialogRef = this.dialog.open(NameDialogComponent, {
      width: '350px',
      data: {title: 'Create new cluster',
        itemsNumber: this.metadataView.tableSelection.selected.length,
        placeholder: 'Type new cluster\'s name'}
    });
    dialogRef.afterClosed().subscribe(result => {
      console.log('dialog closed', result);
      if (result != null) {
        const params = [];
        const values = [];
        for (let index = 0; index < this.metadataView.tableSelection.selected.length; index++) {
          params.push('_id');
          values.push(this.metadataView.tableSelection.selected[index]._id);
        }
        let filter = this.fs.buildShouldMatchFilter(params, values);
        console.log(filter);
        filter = ',' + filter;
        this.es.addTag(
          this.index,
          this.type,
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
        this.metadataView.tableSelection.clear();
      }
    });
  }

  createFilterFromSelection() {
    const dialogRef = this.dialog.open(NameDialogComponent, {
      width: '350px',
      data: {title: 'Create new filter',
        itemsNumber: this.metadataView.tableSelection.selected.length,
        placeholder: 'Type new filter\'s name'}
    });
    dialogRef.afterClosed().subscribe(result => {
      console.log('dialog closed', result);
      if (result != null) {
        const params = [];
        const values = [];
        const filterParams = [];
        for (let index = 0; index < this.metadataView.tableSelection.selected.length; index ++) {
          params.push('_id');
          values.push(this.metadataView.tableSelection.selected[index]._id);
          const filParam = new FilterParamModel();
          filParam.name = '_id';
          filParam.value = this.metadataView.tableSelection.selected[index]._id;
          filterParams.push(filParam);
        }
        const filter = this.fs.buildShouldMatchFilter(params, values);
        const model = new FilterModel();
        model.name = result;
        model.completed = filter;
        model.params = filterParams;
        model.json = filter;
        this.appliedFilters.set(model.name, model);
        this.selectedAppliedFilters.add(model.name);
        this.appliedFiltersKeys.add(model.name);
        this.metadataView.tableSelection.clear();
        this.combineSelectedFilters();
      }
    });
  }

  changeDateBoundary($event) {
    if ($event['xaxis.range[0]'] !== undefined || $event['xaxis.range[1]'] !== undefined) {
      for (const param of this.selectedFilterModel.params) {
        if (param.type === 'DATE') {
          if (param.name === 'FROM') {
            param.value = $event['xaxis.range[0]'].split('.')[0].replace(' ', 'T');
          }
          if (param.name === 'TO') {
            param.value = $event['xaxis.range[1]'].split('.')[0].replace(' ', 'T');
          }
        }
      }
    }
  }

  addComputation() {
      const dialogRef = this.dialog.open(ComputationDialogComponent, {
          width: '350px',
          data: {title: 'Create new computation',
              namePlaceholder: 'Type new filter\'s name',
              colorPlaceHolder: 'Type new color in #RRGGBB format'
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

  addFilter(computation) {
    this.filterPanelOpenState = true;
    this.pickedComputation = computation;
    console.log(this.pickedComputation);
  }

  dragFilter($event, filter: FilterModel, computation: ComputationModel) {
    $event.dataTransfer.setData('filter', JSON.stringify(filter));
    $event.dataTransfer.dropEffect = 'copy';
    $event.effectAllowed = 'copyMove';
  }

  dragOver($event) {
    $event.preventDefault();
  }

  dropFilter($event, computation: ComputationModel) {
    console.log('dropped', computation);
    $event.preventDefault();
    const filter = JSON.parse($event.dataTransfer.getData('filter'));
    console.log('filter', filter);
    computation.filters.add(filter);
  }

}
