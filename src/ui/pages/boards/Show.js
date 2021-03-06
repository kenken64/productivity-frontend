'use strict';

import React, { Component } from 'react';
import { browserHistory } from 'react-router';
import translate from 'app/global/helper/translate';

import ProductivityLayout from 'app/components/layout/Productivity';
import Header from 'app/components/productivity/boards/Header';

import { message } from 'antd';
import _ from 'lodash';
import update from 'immutability-helper';
import Helper from 'app/global/helper';

import { graphql } from 'react-apollo';
import FetchBoardQuery from 'app/graphql/queries/boards/Single';
import updateListPositionsMutation from 'app/graphql/mutations/boards/UpdateListPositions';

import Loading from 'app/components/common/Loading';
import Sortable from 'react-sortablejs';

import List from 'app/components/productivity/lists/Show';
import NewList from 'app/components/productivity/lists/New';


class ShowBoard extends Component {

	constructor(props) {
		super(props);
		this.state = {
		};
		this.handleRedirect = this.handleRedirect.bind(this);
		this.setParentState = this.setParentState.bind(this);
	}

	handleRedirect() {
		browserHistory.push(`/dashboard`);
	}

	setParentState( newstate ) {
		this.setState(newstate);
		if ( newstate.background || newstate.background_image ) { this.setBackground(newstate.background, newstate.background_image); }
		else { this.removeBackground() }
	}

	setBackground(backgroundColor,backgroundImage) {
		if ( backgroundColor ) { document.body.style.backgroundColor = backgroundColor; }
		if ( backgroundImage ) { document.body.style.backgroundImage = `url('${backgroundImage}')`; }
		document.body.classList.add('transparent-header');
	}
	removeBackground() {
		document.body.style.backgroundColor = null;
		document.body.style.backgroundImage = null;
		document.body.classList.remove('transparent-header');
	}

	componentWillReceiveProps(nextProps) {
		if ( nextProps.data.board.meta.background || nextProps.data.board.meta.background_image ) {
			this.setBackground(nextProps.data.board.meta.background, nextProps.data.board.meta.background_image);
		}
	}

	componentWillUnmount() {
		this.removeBackground();
	}



	render() {


		if ( this.props.data.loading ) {
			return <Loading text={ translate('messages.board.show.loading') } />;
		}

		if ( ! this.props.data.board ) {
			setTimeout( () => {
				message.warning( translate('messages.board.show.error') );
				this.handleRedirect();
			}, 50);
			return <Loading text={ translate('messages.board.show.loading') } />;
		}

		const { board } = this.props.data

		const updateListOrder = (order) => {
			const loading_message = message.loading( translate('messages.board.list.position.update') , 0);
			this.props.mutate({
				variables: {
					id: board.id,
					positions: order,
				},
				optimisticResponse: {
					__typename: 'Mutation',
					updateListPositions: {
						__typename: 'Board',
						id: board.id,
						positions: order,
					},
				},
				updateQueries: {
					AllBoards: (previousResult, { mutationResult }) => {
						const index = _.findIndex( previousResult.boards, { id: board.id } );
						const updated = mutationResult.data.updateListPositions;
						return update(previousResult, {
							boards: {
								[index]: {
									positions: {
										$set: updated.positions,
									},
								}
							},
						});
					},
					BoardQuery: (previousResult, { mutationResult }) => {
						const updated = mutationResult.data.updateListPositions;
						return update(previousResult, {
							board: { positions: { $set: updated.positions } },
						});
					}
				},
			})
			.then( res => {
				loading_message();
				message.success( translate('messages.board.list.position.update.success') );
			})
			.catch( res => {
				if ( res.graphQLErrors ) {
					const errors = res.graphQLErrors.map( error => error.message );
					console.log('errors',errors);
				}
			});
		};


		const sortableOnChange = (order, sortable, evt) => {
			return updateListOrder(order);
		}


		const sortableListOptions = {
			group: {
				name: 'lists',
				pull: true,
				put: true
			},
			sort: true,
			handle: 'header',
			filter: '.ignore',
			dataIdAttr: 'data-list-id',
			ghostClass: 'list-sortable-ghost',
			dragClass: 'list-sortable-drag',
			chosenClass: 'list-sortable-chosen',
			scrollSensitivity: 40,
			// animation: 150,
		};



		// sort the lists as well as its cards based on their positions.
		const sorted_lists = Helper.utils.getSortedListsAndCards( board.lists, board.positions );


		return (
			<ProductivityLayout>

				<Header
					title={ board.title }
					description={ board.description }
					board={{ id: board.id, meta: board.meta }}
				/>

				<div className="component__custom_scrollbar">
				<div className="component__productivity__lists">
					<Sortable options={ sortableListOptions } onChange={ sortableOnChange } className="board-lists">
						{ sorted_lists.map( list => <List key={list.id} data={list} board={{ id: board.id }} refetch={ this.props.data.refetch } /> )}
					</Sortable>
					<NewList board={{ id: board.id }} />
				</div>
				</div>

				{ this.props.children &&
					<div>{ React.cloneElement( this.props.children, { data: this.props.data, setParentState: this.setParentState } ) }</div>
				}

			</ProductivityLayout>
		);

	}


}

export default graphql(
	FetchBoardQuery,
	{
		options: (props) => {
			return { variables: {
				id: props.params.id
			} }
		}
	}
)( graphql(updateListPositionsMutation)(ShowBoard) );


