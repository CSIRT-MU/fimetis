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
import {VirtualScrollerModule} from 'ngx-virtual-scroller';
import {MatTooltipModule} from '@angular/material';

import {AppComponent} from './app.component';
import {ElasticsearchService} from './elasticsearch.service';
import {ListViewComponent} from './UI/listView/listView.component';
import {GraphComponent} from './UI/graph/graph.component';
import { DashboardComponent } from './UI/dashboard/dashboard.component';
import { ClusterComponent } from './UI/cluster/cluster.component';
import { NameDialogComponent } from './UI/dialog/name-dialog/name-dialog.component';
import { SelectDialogComponent } from './UI/dialog/select-dialog/select-dialog.component';
import { ComputationDialogComponent } from './UI/dialog/computation-dialog/computation-dialog.component';
import { TextSelectDirective } from './UI/text-select.directive';

@NgModule({
  declarations: [
    AppComponent,
    ListViewComponent,
    GraphComponent,
    DashboardComponent,
    ClusterComponent,
    NameDialogComponent,
    SelectDialogComponent,
    ComputationDialogComponent,
    TextSelectDirective
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
    VirtualScrollerModule,
    MatTooltipModule
  ],
  entryComponents: [NameDialogComponent, SelectDialogComponent, ComputationDialogComponent],
  providers: [ElasticsearchService],
  bootstrap: [AppComponent]
})

export class AppModule {}
