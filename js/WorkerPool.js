WorkerPool = function( nWorkers, workerFile )
{
    this.nWorkers = nWorkers;
    this.workers = [];
    // list of free workers
    this.freeWorkers = []
    for ( var i = 0; i < this.nWorkers; i++ ) {
        this.workers[i] = new Worker(workerFile);
        this.freeWorkers.push(i);
    }
    // queue of waiting jobs, when all workers are busy
    this.jobqueue = [];
}

WorkerPool.prototype.enqueueJob = function( msg, callback )
{
    if ( this.freeWorkers.length > 0 ) {
        var wi = this.freeWorkers.shift();
        //console.log('[WorkerPool] Using worker #' + wi, this.freeWorkers.length );
        var worker = this.workers[wi];
        msg.workerId = wi;
        worker.onmessage = callback;
        worker.postMessage( msg );
    }
    else {
        // else, all workers are busy
        //console.log('[WorkerPool] All workers busy, enqueing ...');
        this.jobqueue.push( [msg, callback] );
    }
}

WorkerPool.prototype.releaseWorker = function( wi )
{
    if ( this.jobqueue.length > 0 ) {
        var m = this.jobqueue.shift();
        var msg = m[0];
        var callback = m[1];
        var worker = this.workers[wi];
        msg.workerId = wi;
        worker.onmessage = callback;
        worker.postMessage( msg );
    }
    else {
        this.freeWorkers.push( wi );
    }
}

