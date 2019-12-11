import { Component, OnInit } from '@angular/core';
import {BaseService} from '../../services/base.service';
import {ClusterService} from '../../services/cluster.service';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationDialogComponent} from '../dialog/confirmation-dialog/confirmation-dialog.component';
import {AddClusterDefinitionComponent} from '../dialog/add-cluster-definition/add-cluster-definition.component';
import {SelectClustersComponent} from '../dialog/select-clusters/select-clusters.component';

@Component({
  selector: 'app-cluster-management',
  templateUrl: './cluster-management.component.html',
  styleUrls: ['./cluster-management.component.css']
})
export class ClusterManagementComponent implements OnInit {

  constructor(public dialog: MatDialog,
              private clusterService: ClusterService,
              private baseService: BaseService) { }

  clusterDefinitions = [];
  filters = [];
  ngOnInit() {
    this.loadAllClusters();
    this.loadAllFilters();
  }

  loadAllClusters() {
    this.clusterDefinitions = [];
    this.clusterService.loadClustersFromDatabase().then(
        response => {
          for (let i = 0; i < response.cluster_definitions.length; i++ ) {
            const tmpClusterDefinition = {
              'id': response.cluster_definitions[i]['id'],
              'name': response.cluster_definitions[i]['name'],
              'definition': response.cluster_definitions[i]['definition'],
              'description': response.cluster_definitions[i]['description'],
              'filter_name': response.cluster_definitions[i]['filter_name']
            };
            this.clusterDefinitions.push(tmpClusterDefinition);
          }
        }, error => {
          console.error(error);
        }).then(() => {
      console.log('Cluster definitions loaded');
    });
  }

  addClusterDefinition() {
    const dialogRef = this.dialog.open(AddClusterDefinitionComponent, {
      width: '70%',
      height: '50%',
      data: {
        title: 'Add new cluster definition',
        filters: this.filters
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.clusterService.addClusterDefinition(result['name'], result['definition'], result['description'], result['filter_name']).then(
            response => {
              this.loadAllClusters();
            }, error => {
              console.error(error);
            });
        }

    });
  }

  loadAllFilters() {
    this.filters = [];
    this.baseService.loadFiltersFromDatabase().then(
        response => {
          this.filters = response.filters;
        }, error => {
          console.error(error);
        }).then(() => {
      console.log('filters definitions loaded');
    });
  }

  removeSelectedClusterDefinition(id) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '350px',
      data: {
        title: 'Are you sure ?',
        message: 'You want to delete cluster definition',
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.clusterService.deleteClusterDefinition(id).then(
            response => {
              console.log('Cluster definition deleted', response);
              this.loadAllClusters();
            }, error => {
              console.error(error);
            }).then(() => {
          console.log('Delete completed!');
        });
      }
    });
  }





}
