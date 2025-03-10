#!/bin/bash

sudo /usr/sbin/sshd
exec "$@"
