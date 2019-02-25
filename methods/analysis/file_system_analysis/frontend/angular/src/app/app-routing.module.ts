import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {UploadComponent} from './UI/upload/upload.component';
import {DashboardComponent} from './UI/dashboard/dashboard.component';

const routes: Routes = [
    {path: 'upload', component: UploadComponent},
    {path: 'dashboard', component: DashboardComponent},
    {path: '', redirectTo: '/dashboard', pathMatch: 'full'},
    {path: '**', redirectTo: '/dashboard'}
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})

export class AppRoutingModule {
}
