import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {MarkForbidenDialogComponent} from './mark-forbiden-dialog.component';

describe('MarkForbidenDialogComponent', () => {
    let component: MarkForbidenDialogComponent;
    let fixture: ComponentFixture<MarkForbidenDialogComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [MarkForbidenDialogComponent]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(MarkForbidenDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
