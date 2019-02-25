import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {NameDialogComponent} from './name-dialog.component';

describe('NameDialogComponent', () => {
    let component: NameDialogComponent;
    let fixture: ComponentFixture<NameDialogComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [NameDialogComponent]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(NameDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
