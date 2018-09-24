import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule, MatListModule} from '@angular/material';
import {BrowserAnimationsModule, NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material';
import { FlexLayoutModule } from '@angular/flex-layout';
import {MatChipsModule} from '@angular/material/chips';
import { PlotlyModule } from 'angular-plotly.js';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material';
import {MatIconModule} from '@angular/material/icon';
import {MatTabsModule} from '@angular/material/tabs';
import {MatSelectModule} from '@angular/material/select';
import {MatRadioModule} from '@angular/material/radio';
import { PerfectScrollbarModule } from 'ngx-perfect-scrollbar';
import { MatTableModule} from '@angular/material';
import { MatCheckboxModule } from '@angular/material';
import {MatSortModule} from '@angular/material/sort';
import {MatDialogModule} from '@angular/material/dialog';
import {MatMenuModule} from '@angular/material/menu';
import { VirtualScrollModule } from 'angular2-virtual-scroll';

import {AppComponent} from './app.component';
import {ElasticsearchService} from './elasticsearch.service';
import {ShowMetadataComponent} from './metadata/show-metadata/show-metadata.component';
import {DetailMetadataComponent} from './metadata/detail-metadata/detail-metadata.component';
import {ShowCaseComponent} from './case/show-case/show-case.component';
import {DetailCaseComponent} from './case/detail-case/detail-case.component';
import {SubMetadataComponent} from './metadata/sub-metadata/sub-metadata.component';
import {ShowGraphComponent} from './graph/show-graph/show-graph.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ClusterComponent } from './cluster/cluster.component';
import { NameDialogComponent } from './dialog/name-dialog/name-dialog.component';
import { SelectDialogComponent } from './dialog/select-dialog/select-dialog.component';


@NgModule({
  declarations: [
    AppComponent,
    ShowMetadataComponent,
    DetailMetadataComponent,
    ShowCaseComponent,
    DetailCaseComponent,
    SubMetadataComponent,
    ShowGraphComponent,
    DashboardComponent,
    ClusterComponent,
    NameDialogComponent,
    SelectDialogComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    BrowserAnimationsModule,
    NoopAnimationsModule,
    MatExpansionModule,
    MatListModule,
    MatCardModule,
    MatButtonModule,
    FlexLayoutModule,
    MatChipsModule,
    PlotlyModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatTabsModule,
    MatSelectModule,
    MatRadioModule,
    PerfectScrollbarModule,
    MatTableModule,
    MatCheckboxModule,
    MatSortModule,
    MatDialogModule,
    MatMenuModule,
    VirtualScrollModule
  ],
  entryComponents: [NameDialogComponent, SelectDialogComponent],
  providers: [ElasticsearchService],
  bootstrap: [AppComponent]
})

export class AppModule {}
