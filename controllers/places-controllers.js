const HttpError = require('../modals/http-error');
const {v4: uuid} = require('uuid');
const { validationResult } = require('express-validator');
const getCoordsForAddress = require('../util/location');
const Place = require('../modals/place');
const User = require('../modals/user');
const mongoose = require('mongoose');

const fs = require('fs');


const getPlaceById = async (req, res, next) => {
    const placeId = req.params.pid;
    let place;
    try {
        place = await Place.findById(placeId);
    } catch (err) {
        const error = new HttpError('Something went wrong, Could not find a place', 500);
        return next(error);
    }
    if (!place) {
        const error = new HttpError('Could not find a place', 404);
        return next(error);
    }
    res.json({ place: place.toObject({getters: true}) });
}

const getPlacesByUserId = async (req, res, next) => {
    const userId = req.params.uid;
    // let places;
    let userWithPlaces;
    try {
        // places = await Place.find({ creator: userId });
        userWithPlaces = await User.findById(userId).populate('places')
    } catch (err) {
        const error = new HttpError('Fetching places failed', 500);
        return next(error);
    }
    // if (!places || places.length === 0) {
    if (!userWithPlaces || userWithPlaces.places.length === 0 ) {
        // const error = new Error('Could not find a place');
        // error.code = 404;
        return next(new HttpError('Could not find a place', 404));
    }
    res.json({places: userWithPlaces.places.map(place => place.toObject({getters: true}))});
}

const createPlace = async (req, res, next) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()) {
        console.log('err', errors);
        return next(new HttpError('Invalid Input!', 422)); // when working with async threw does not work
    }

    const { title, description, address } = req.body;
    const coordinates = await getCoordsForAddress(address);
    // try {
    //     const coordinates = await getCoordsForAddress(address);
    // } catch (error){
    //     return next(error);
    // }
    
    const createdPlace = new Place({
        title,
        description,
        location: coordinates,
        address,
        image: req.file.path,
        creator: req.userData.userId
    })

    let user;

    try {
        user = await User.findById(req.userData.userId);
    } catch (err) {
        const error = new HttpError('Creating place failed', 500);
        return next(error);
    }

    if (!user) {
        const error = new HttpError('Could not find user ', 404);
        return next(error);
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdPlace.save({session: sess});
        user.places.push(createdPlace);
        await user.save({session: sess});
        await sess.commitTransaction();
    } catch (err) {
        const error = new HttpError('Creating place failed!', 500); 
        return next(error);
    }

    res.status(201).json({place: createdPlace});
}

const updatePlace = async (req, res, next) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()) {
        throw new HttpError('Invalid Input!', 422);
    }

    const { title, description } = req.body;
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId);
    } catch (err) {
        const error = new HttpError('Could not update place', 500);
        return next(error);
    }

    if (place.creator.toString() !== req.userData.userId) {
        const error = new HttpError('You are not allowed to edit', 401);
        return next(error);
    }
    
    place.title = title;
    place.description = description;
    
    try {
        await place.save();
    } catch (err) {
        const error = new HttpError('Could not update place', 500);
        return next(error);
    }
    
    res.status(200).json({ place: place.toObject({getters: true}) });
}

const deletePlace = async (req, res, next) => {
    const placeId = req.params.pid;
    let place;
    try {
        place = await Place.findById(placeId).populate('creator');
    } catch(err) {
        const error = new HttpError('Could not delete', 500);
        return next(error);
    }

    if (!place) {
        const error = new HttpError('Could not find place for this id', 404);
        return next(error);
    }

    if (place.creator.id !== req.userData.userId) {
        const error = new HttpError('You are not allowed to delete', 401);
        return next(error);
    }

    const imagePath = place.image;

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await place.deleteOne({session: sess});
        place.creator.places.pull(place);
        await place.creator.save({session: sess});
        await sess.commitTransaction();
    } catch(err) {
        const error = new HttpError('Could not delete', 500);
        return next(error);
    }
    fs.unlink(imagePath, err => {
        console.log(err);
    });
    res.status(200).json({message: 'deleted'});
}

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.deletePlace = deletePlace;
exports.updatePlace = updatePlace;