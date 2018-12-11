import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {ListViewComponent} from './UI/listView/listView.component';

const routes: Routes = [
    {path: '', redirectTo: 'dashboard', pathMatch: 'full'},
    {path: 'metadata/:type/:case', component: ListViewComponent}
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})

export class AppRoutingModule {
}
