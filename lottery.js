'use strict'

var config = require('./config').config;
var fs = require("fs");
var data = fs.readFileSync( __dirname+'/data/users.txt'); 
var allUsers = data.toString().trim().split("\n");
var current = null;//当前奖项
var tasks = [];//所有任务
var rewards = [];//任务奖项

if (!Array.indexOf) {  
    Array.prototype.indexOf = function (obj) {  
        for (var i = 0; i < this.length; i++) {  
            if (this[i] == obj) {  
                return i;  
            }  
        }  
        return -1;  
    }  
}  
initData();
//待抽取名单=总-排除
function filterRestUser(except)
{
    var restUsers = [];
    for(var i=0; i<allUsers.length; i++){
        var user = allUsers[i].trim();
        if (except.indexOf(user) == -1) {
            restUsers.push(user);
        }
    }
    console.log('排除名单('+except.length+')：'+ except.toString());
    console.log('剩下名单('+restUsers.length+')：'+ restUsers.toString());
    return restUsers;
}

function initData()
{
    //遍历任务
    for(var i=0; i<config.tasks.length;i++) {
        var task = config.tasks[i];
        tasks.push({
            id:i,
            title: task.title,
            restUsers:filterRestUser(task.except),//每个任务待抽取用户都是（完整用户-排除用户）
            consumeUsers:[],//本轮任务各环节已中奖用户（这里没用到）
            lastRandUsers:[]//暂存本环节中奖用户
        });
        //遍历该任务下的所设置的奖项
        if (task.rewards) {
            for(var j=0; j<task.rewards.length; j++) {
                var reward = task.rewards[j];
                rewards.push({
                    id:j,
                    taskId:i,
                    title:reward.title,
                    count:reward.count,//奖项数量
                    capacity:reward.capacity,//一次抽取数量
                    consume:0,//x任务下x环节已抽出的人数
                    cols:getCols(reward.namesOfLine)
                });
            }
        }
    }
}

function getCols(number)
{
    switch(number) {
        case 1:
            return 12;
        case 2:
            return 6;
        case 3:
            return 4;
        case 4:
            return 3;
        case 6:
            return 2;
        case 12:
            return 1;
        default:
            return 4;
    }
}

function canStart()
{
    return !isRewardCompleted(current);
}
//本轮抽奖是否结束
function isRewardCompleted(reward) {
    if (reward!=null) {
        return reward.count > reward.consume? false:true;
    }
    return true;
}
//下一环节
function nextReward(){
    if (isRewardCompleted(current)) {
        current = rewards.shift();
    }
    return current;
}
//添加候选环节(只抽一个)
function alternateReward(){
    if (isRewardCompleted(current)) {
        if(current==null){
            current = {id:0,taskId:0,title:''} ;
        }
        current = {
                    id:current.id,
                    taskId:current.taskId,
                    title:current.title,
                    count:1,//奖项数量
                    capacity:1,//一次抽取数量
                    consume:0,//x任务下x环节已抽出的人数
                    cols:getCols(1)
                };
    }
    return current;
}
//随机产生中奖用户
function randomUsers()
{
    if (!isRewardCompleted(current)) {
        var task = tasks[current.taskId];//当前task
        var length = task.restUsers.length;//当前task的待抽选人员数量
        //计算得出 consumeNumber（本次随机数量）
        var rest = current.count - current.consume;//剩余奖项数量=本轮抽奖总数量-本轮已抽取数量
        var consumeNumber = rest < current.capacity ? rest:current.capacity;//剩余奖项数量 和 一次抽取数量 取最小值
        consumeNumber = length < consumeNumber ? length: consumeNumber;//避免剩余奖品比剩余待抽人多的情况

        var randomUsers = [];
        while(randomUsers.length < consumeNumber ){
            var idx = Math.floor(Math.random()*length);
            if (randomUsers.indexOf(task.restUsers[idx]) == -1) {//随机结果去重复
                randomUsers.push(task.restUsers[idx]);
            }
        }
        tasks[current.taskId].lastRandUsers = randomUsers;//保存中奖人
        return randomUsers;
    }
    return false;
}

function completedOnceRolling()
{
    if (!isRewardCompleted(current)) {
        var task = tasks[current.taskId];
        console.log('Lottery taskId '+ current.taskId + ' 中奖用户: ' + task.lastRandUsers.toString());
        if (task.lastRandUsers.length > 0 ) {
            //计算得出 consumeNumber（本次随机数量）
            var rest = current.count - current.consume;
            var consumeNumber = rest < current.capacity ? rest:current.capacity;
            var restUsers=[];
            //重新准备待选人，踢出已中奖
            for(var i=0; i<task.restUsers.length; i++) {
                if (task.lastRandUsers.indexOf(task.restUsers[i])==-1){
                    restUsers.push(task.restUsers[i]);
                }
            }
            current.consume = current.consume + consumeNumber;//重新赋值 本轮已抽取人数
            tasks[current.taskId].restUsers = restUsers;//重新赋值 待抽取人
            tasks[current.taskId].lastRandUsers = [];//重新置空
            tasks[current.taskId].consumeUsers.push(task.lastRandUsers);
            
            console.log('Lottery taskId '+ current.taskId + ' 余下('+tasks[current.taskId].restUsers.length+'):' + tasks[current.taskId].restUsers.toString());

            return true;
        }
    }
    return false;
}


module.exports = {
    config:config,
    currentReward:()=>{
        return current;
    },
    canStart:canStart,
    nextReward:nextReward,
    alternateReward:alternateReward,
    randomUsers:randomUsers,
    completedOnceRolling:completedOnceRolling
}