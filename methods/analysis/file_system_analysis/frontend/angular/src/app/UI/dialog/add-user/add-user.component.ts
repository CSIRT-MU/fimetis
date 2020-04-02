import { Component, Inject, OnInit } from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {FormControl, Validators} from '@angular/forms';

@Component({
  selector: 'app-add-user',
  templateUrl: './add-user.component.html',
  styleUrls: ['./add-user.component.css']
})
export class AddUserComponent implements OnInit {

    constructor(
        public dialogRef: MatDialogRef<AddUserComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
        ) {
    }

    login = ''
    name = '';
    email = '';
    password = '';

    emailValidators = [Validators.email];
    loginValidators = [Validators.required, Validators.minLength(3)];
    passwordValidators = [Validators.required, Validators.minLength(8)];

    isEmailValid = new FormControl('', this.emailValidators);
    isLoginValid = new FormControl('', this.loginValidators);
    isPasswordValid = new FormControl('', this.passwordValidators);

    ngOnInit() {
    }

    updateName(name) {
        this.name = name;
    }

    updateLogin(login) {
        this.login = login;
    }

    updateEmail(email) {
        this.email = email;
    }

    updatePassword(password) {
        this.password = password;
    }

    onSaveClick() {
        if (!this.isLoginUnique()) {
            return false;
        }

        this.dialogRef.close({
        'name': this.name,
        'login': this.login,
        'password': this.password,
        'email': this.email
        });
    }

    isLoginUnique() {
        for (let i = 0; i < this.data.users.length; i++) {
            if (this.login === this.data.users[i].login) {
                return  false;
            }
        }
        return true;
    }


    onCancelClick() {
        this.dialogRef.close(false);
    }
}
