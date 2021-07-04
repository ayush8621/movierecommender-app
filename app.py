#Importing required modules
import socketio
import pandas as pd
import numpy as np
import nltk
import json
import pymongo

#Loading data
file_name=['./data/features.npz','./data/movies']
features=np.load(file_name[0])['arr_0']
movies=pd.read_feather(file_name[1])

#Defining functions to be used
def distance(row,string):
    return nltk.edit_distance(row[2],string)

#Creating client object
client=socketio.Client()
client.connect('http://localhost:3000')

#Defining events
@client.on('connect')
def on_connect():
    print('Connected to node js server!')

@client.on('message')
def on_message(msg):
    print('Message Recieved: ',msg)

@client.on('search')
def search(user_inp):
    output=movies.copy()
    dist=output.apply(distance,axis=1,string=user_inp,raw=True)
    output.insert(2,'distance',value=dist)
    output=output.sort_values(by='distance')[0:9]
    return output[['_id']].to_dict(orient='records')

@client.on('recommend')
def content_based(json_obj):
    output=movies.copy()
    ind=[item['_id'] for item in json_obj]
    rat=[item['rating'] for item in json_obj]

    user_data=rat.reshape(1,-1).dot(features[ind])
    similarity=features.dot(user_data.reshape(-1,1))
    similarity[[ind]]=0

    output.insert(2,column='similarity',value=similarity)
    result=movies_sim.sort_values(by='similarity',ascending=False)[0:10]
    return result[['_id']].to_dict(orient='records')

search('b')
