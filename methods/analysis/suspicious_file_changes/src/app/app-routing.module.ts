import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {ShowMetadataComponent} from './metadata/show-metadata/show-metadata.component';
import {ShowCaseComponent} from './case/show-case/show-case.component';

const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard/:type', component: ShowCaseComponent },
    { path: 'metadata/:type/:case', component: ShowMetadataComponent }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})

export class AppRoutingModule { }
